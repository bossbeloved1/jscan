# JScan starter project

This is the first frontend milestone for JScan. It uses plain HTML, CSS and JavaScript. It does **not** require Node.js.

## Included now
- Responsive homepage
- Explore tools page with search
- Dedicated QR Code Generator page
- Live QR colour and background colour controls
- Native colour picker, hex input and preset swatches
- PNG and SVG downloads
- Light/dark theme toggle saved in browser
- Initial separate-page placeholders for future tools
- Supabase setup placeholder (no credentials included)

## Run locally
1. Extract the `JScan` folder.
2. Open `index.html` in Chrome, Edge or Firefox.
3. Internet is required for the QR library CDN and Google Fonts in this starter version.

## QR generator
The QR generator uses QRCode.js from cdnjs. The generated code updates as the user changes text or colours. The current SVG download embeds a PNG image inside an SVG wrapper; a future improvement can produce vector QR modules directly.

## Supabase setup (next backend step)
1. Create a Supabase project.
2. Copy Project URL and anon/public key into `js/supabase.js`.
3. Configure Supabase Auth, database tables, storage buckets and Row Level Security.
4. Do not put the Supabase `service_role` key in frontend code.

## Important status
Only the homepage, tool directory and QR generator are implemented in this first milestone. Other feature pages are clearly marked as coming next; they are not yet functional. The registered-user limits and guest trial enforcement must be implemented securely with Supabase policies/Edge Functions before public launch.
