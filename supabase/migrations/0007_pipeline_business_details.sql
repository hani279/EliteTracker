-- "Add client" now captures a business name and contact details
-- alongside the existing owner/contact name — the checklist's
-- "Update 'Add Client' to capture business name and other details."
alter table pipeline_items add column if not exists business_name text not null default '';
alter table pipeline_items add column if not exists phone text not null default '';
alter table pipeline_items add column if not exists email text not null default '';
