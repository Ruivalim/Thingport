-- The storage template's {category} token is now {category-or-folder}, as a model's place can be a
-- category or a folder. The old token is still accepted as an alias; this just stores the new name.
UPDATE "Setting"
SET value = to_jsonb(replace(value #>> '{}', '{category}', '{category-or-folder}'))
WHERE key = 'storage_path_template' AND (value #>> '{}') LIKE '%{category}%';
