-- Bucket public pentru fișierele STL încărcate din formularul /servicii.
-- Public = citire liberă prin URL public (la fel ca imaginile de produs),
-- dar upload (INSERT) e permis explicit doar prin policy-ul de mai jos.
insert into storage.buckets (id, name, public, file_size_limit)
values ('proiecte-stl', 'proiecte-stl', true, 52428800) -- 50MB
on conflict (id) do nothing;

-- Permite oricui (rol anon, folosit de site prin cheia publică anon)
-- să încarce fișiere noi în acest bucket. Fără UPDATE/DELETE pentru anon,
-- deci fișierele urcate nu pot fi suprascrise sau șterse din client.
create policy "Allow public uploads to proiecte-stl"
on storage.objects
for insert
to anon
with check (bucket_id = 'proiecte-stl');
