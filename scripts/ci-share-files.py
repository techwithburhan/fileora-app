"""CI (app 1.2.4): small real test files for the Android share tests: a 2-page PDF, a DOCX, an XLSX,
a PPTX and a PNG, written into the folder given (then pushed to the emulator's Download folder)."""
import struct
import sys
import zipfile
import zlib
from pathlib import Path

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)


def pdf(path, pages=2):
    objs = ["<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [" + " ".join(f"{3 + 2 * i} 0 R" for i in range(pages)) + f"] /Count {pages} >>"]
    for i in range(pages):
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents {4 + 2 * i} 0 R /Resources << /Font << /F1 {3 + 2 * pages} 0 R >> >> >>")
        text = f"BT /F1 18 Tf 40 100 Td (Fileora share test, page {i + 1}) Tj ET".encode()
        objs.append(f"<< /Length {len(text)} >>\nstream\n".encode().decode() + text.decode() + "\nendstream")
    objs.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    body, offs = b"%PDF-1.4\n", []
    for n, o in enumerate(objs, 1):
        offs.append(len(body))
        body += f"{n} 0 obj\n{o}\nendobj\n".encode()
    x = len(body)
    body += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode() + b"".join(f"{o:010d} 00000 n \n".encode() for o in offs)
    body += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode()
    path.write_bytes(body)


def ooxml(path, kind):
    ct = {"docx": ("word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
                   '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Fileora share test</w:t></w:r></w:p></w:body></w:document>',
                   "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"),
          "xlsx": ("xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
                   '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
                   "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"),
          "pptx": ("ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
                   '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',
                   "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument")}[kind]
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", f'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/{ct[0]}" ContentType="{ct[1]}"/></Types>')
        z.writestr("_rels/.rels", f'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{ct[3]}" Target="{ct[0]}"/></Relationships>')
        z.writestr(ct[0], '<?xml version="1.0" encoding="UTF-8"?>' + ct[2])


def png(path, w=120, h=80):
    raw = b"".join(b"\x00" + b"".join(bytes((x * 2 % 256, y * 3 % 256, 160)) for x in range(w)) for y in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


pdf(out / "fileora-share-test.pdf")
ooxml(out / "fileora-share-test.docx", "docx")
ooxml(out / "fileora-share-test.xlsx", "xlsx")
ooxml(out / "fileora-share-test.pptx", "pptx")
png(out / "fileora-share-test.png")
print("\n".join(sorted(p.name for p in out.iterdir())))
