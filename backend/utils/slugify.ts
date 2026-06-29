export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
};

export const generateUniqueSlug = async (
  baseName: string,
  model: any
): Promise<string> => {
  let slug = slugify(baseName);
  let count = 0;
  let uniqueSlug = slug;

  while (await model.findOne({ slug: uniqueSlug })) {
    count++;
    uniqueSlug = `${slug}-${count}`;
  }

  return uniqueSlug;
};
