"""Sets the resume PDF's author, title and subject (Chrome writes only the title). Needs pypdf (PYTHONPATH).
  python3 scripts/resume-meta.py public/Liam-Hasson-Resume.pdf"""
import sys
from pypdf import PdfReader, PdfWriter
path = sys.argv[1]
w = PdfWriter(clone_from=PdfReader(path))
w.add_metadata({"/Title": "Liam Hasson — Product Designer", "/Author": "Liam Hasson", "/Subject": "Resume", "/Creator": "liamhasson.com"})
with open(path, "wb") as f:
    w.write(f)
print("metadata set:", path)
