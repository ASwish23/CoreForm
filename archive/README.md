# Archived: product catalogue

These files are the public product catalogue of CoreForm Prints. They were taken
offline on purpose but are kept so the shop can come back later.

| File          | Was                                              |
|---------------|--------------------------------------------------|
| produse.html  | `/produse`  – product grid (reads Supabase `produse` table) |
| produs.html   | `/produs?id=…` – single product template         |
| produs.js     | logic for produs.html                            |
| produse.css   | styles for produse.html                          |

## Why they are not reachable
- `archive/` is blocked in `.htaccess` and excluded from the FTP deploy.
- `/produse` and `/produs` (with or without `.html`) 301-redirect to `/prints`
  in `.htaccess`, so old links and bookmarks still land somewhere useful.
- All links to them were removed from the Prints pages, `404.html`,
  `sitemap.xml`, and the cart / checkout scripts.

## To restore
1. `git mv archive/produse.html archive/produs.html archive/produs.js archive/produse.css .`
2. Delete the "Archived product catalogue" block in `.htaccess` and the `archive/` entries
   (`.htaccess` + `.github/workflows/deploy.yml`).
3. Re-add the "Produse" nav/footer links, the `/produse` entry in `sitemap.xml`,
   and the cart links in `cos.js` / `checkout.js`.

`database.js`, `cos.*`, `checkout.*` and `produse.csv` stay in the project root
(checkout and the order-success page still use `database.js`).
