-- CRM redesign: separate phone/email fields instead of one free-text
-- "contact" string, and a lead-stage funnel (New/Contacted/Qualified/
-- Negotiating/Won/Lost) instead of a Hot/Warm/Cold temperature — the
-- temperature scale didn't reflect where a contact actually was in the
-- pipeline, just a vibe.
alter table crm_contacts drop constraint if exists crm_contacts_type_check;

alter table crm_contacts rename column contact to phone;
alter table crm_contacts add column if not exists email text not null default '';

alter table crm_contacts rename column type to stage;
alter table crm_contacts alter column stage set default 'New';
update crm_contacts set stage = 'New' where stage not in ('New','Contacted','Qualified','Negotiating','Won','Lost');
alter table crm_contacts add constraint crm_contacts_stage_check
  check (stage in ('New','Contacted','Qualified','Negotiating','Won','Lost'));
