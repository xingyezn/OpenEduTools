import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const categories = new Set([
  'lesson-planning', 'classroom-management', 'assessment', 'research',
  'data-processing', 'text-processing', 'ai-assistance', 'general'
]);
export const statuses = new Set(['experimental', 'beta', 'stable', 'deprecated']);
export const icons = new Set(['user-search', 'users', 'timer', 'text-clean', 'chart']);
const toolSchema = JSON.parse(fs.readFileSync(path.join(rootDir, 'schemas', 'tool.schema.json'), 'utf8'));

export function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateAgainstSchema(value, schema, location = '$') {
  const errors = [];
  if (Object.hasOwn(schema, 'const') && value !== schema.const) errors.push(`${location} 必须等于 ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((item) => item === value)) errors.push(`${location} 不在允许值中`);
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${location} 必须是对象`];
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) errors.push(`${location} 缺少字段 ${key}`);
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties || {}, key)) errors.push(`${location} 包含未知字段 ${key}`);
    for (const [key, child] of Object.entries(schema.properties || {})) if (Object.hasOwn(value, key)) errors.push(...validateAgainstSchema(value[key], child, `${location}.${key}`));
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) return [`${location} 必须是数组`];
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${location} 至少包含 ${schema.minItems} 项`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${location} 最多包含 ${schema.maxItems} 项`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${location} 不得包含重复项`);
    if (schema.items) value.forEach((item, index) => errors.push(...validateAgainstSchema(item, schema.items, `${location}[${index}]`)));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') return [`${location} 必须是字符串`];
    const length = Array.from(value).length;
    if (schema.minLength !== undefined && length < schema.minLength) errors.push(`${location} 长度不得少于 ${schema.minLength}`);
    if (schema.maxLength !== undefined && length > schema.maxLength) errors.push(`${location} 长度不得超过 ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${location} 格式不正确`);
    if (schema.format === 'date' && !isDate(value)) errors.push(`${location} 必须是有效 YYYY-MM-DD 日期`);
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') errors.push(`${location} 必须是布尔值`);
  return errors;
}

export function validateMetadata(meta, context = {}) {
  const errors = validateAgainstSchema(meta, toolSchema);
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return errors;
  if (meta.id && meta.entry !== `tools/${meta.id}/index.html`) errors.push(`entry 必须为 tools/${meta.id}/index.html`);
  if (Array.isArray(meta.tags) && meta.tags.some((tag) => typeof tag === 'string' && tag.trim() !== tag)) errors.push('tags 项不得含首尾空格');
  if (isDate(meta.createdAt) && isDate(meta.updatedAt) && meta.updatedAt < meta.createdAt) errors.push('updatedAt 不得早于 createdAt');
  if (context.directoryName && meta.id !== context.directoryName) errors.push(`id 与目录名 ${context.directoryName} 不一致`);
  return errors;
}

export function readToolMetadata() {
  const toolsDir = path.join(rootDir, 'tools');
  if (!fs.existsSync(toolsDir)) return [];
  return fs.readdirSync(toolsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => {
      const file = path.join(toolsDir, entry.name, 'tool.json');
      if (!fs.existsSync(file)) return { directoryName: entry.name, file, parseError: '缺少 tool.json' };
      try { return { directoryName: entry.name, file, meta: JSON.parse(fs.readFileSync(file, 'utf8')) }; }
      catch (error) { return { directoryName: entry.name, file, parseError: error.message }; }
    });
}
