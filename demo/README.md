# demo/

Place two public, text-based PDF agreements here:
- `demo-1.pdf`
- `demo-2.pdf`

Requirements (from plan.md Phase 0):
- Public documents (e.g. contract exhibits from SEC EDGAR)
- 15–30 pages
- Must have a text layer (not scanned)

Verify with:
  python -c "from pypdf import PdfReader; r=PdfReader('demo/demo-1.pdf'); print(len(r.pages), len(r.pages[0].extract_text()))"
Expected output: page count + >200 characters of text.
