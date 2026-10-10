import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  // 扫描 src/content/blog 目录下的所有 md 和 mdx 文件
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Frontmatter 校验 Schema
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // 设为可选并提供兜底空字符串，防止漏填 description 导致构建中断
      description: z.string().optional().default(''),
      // 自动转换日期类型，未提供时兜底为当前时间
      pubDate: z.coerce.date().default(() => new Date()),
      updatedDate: z.coerce.date().optional(),
      // 封面图设为可选
      heroImage: z.optional(image()),
    }),
});

export const collections = { blog };