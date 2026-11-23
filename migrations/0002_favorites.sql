-- Members star played sermons to pin them to the top of their Played list.
alter table playback_progress
  add column favorite integer not null default 0 check (favorite in (0, 1));
