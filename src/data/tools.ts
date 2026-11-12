/**
 * Fileora tools – generated from the Fileora Core plugin's modules (plugin 2.16.0).
 * Edit PDF is still "pending" on the website: it is listed (as unavailable) like the other API tools.
 * The tool page is https://www.fileora.in/<slug>/ (Tool Management can change slugs: update here too).
 */
import { API_TOOLS_LIVE } from '../config';

export type CategoryId = 'pdf' | 'image' | 'converter' | 'optimizer' | 'security' | 'editor' | 'ai';
export type Exec = 'browser' | 'server' | 'hybrid';

export type Category = { id: CategoryId; name: string; desc: string; count: number };
export type Tool = { id: string; slug: string; name: string; desc: string; cat: CategoryId; exec: Exec; keys: string; pending?: boolean };

export const CATEGORIES: Category[] = [
  {
    "id": "pdf",
    "name": "PDF Tools",
    "desc": "Merge, split, organize, sign, number and print PDFs, right in your browser.",
    "count": 30
  },
  {
    "id": "image",
    "name": "Image Tools",
    "desc": "Compress, resize, crop and convert photos without uploading them.",
    "count": 21
  },
  {
    "id": "converter",
    "name": "File Converter",
    "desc": "Turn Word, Excel, PowerPoint and web pages into PDFs, and back again.",
    "count": 8
  },
  {
    "id": "optimizer",
    "name": "File Optimizer",
    "desc": "Shrink files, fix damaged ones and make scans searchable.",
    "count": 4
  },
  {
    "id": "security",
    "name": "File Security",
    "desc": "Lock, unlock and permanently black out sensitive content.",
    "count": 3
  },
  {
    "id": "editor",
    "name": "File Edit",
    "desc": "Turn flat PDFs into fillable forms and edit page content.",
    "count": 2
  },
  {
    "id": "ai",
    "name": "Fileora AI",
    "desc": "Summarize and translate documents with AI.",
    "count": 2
  }
];

export const TOOLS: Tool[] = [
  {
    "id": "merge",
    "slug": "merge-pdf",
    "name": "Merge PDF",
    "desc": "Combine several PDFs into one file, in exactly the order you want.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "combine join append together one file"
  },
  {
    "id": "split",
    "slug": "split-pdf",
    "name": "Split PDF",
    "desc": "Pull out page ranges or break a PDF into separate files.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "extract pages separate divide cut remove"
  },
  {
    "id": "organize",
    "slug": "organize-pdf",
    "name": "Organize PDF",
    "desc": "Reorder, rotate and delete pages using a visual page view.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "reorder sort pages delete remove move arrange"
  },
  {
    "id": "rotate",
    "slug": "rotate-pdf",
    "name": "Rotate PDF",
    "desc": "Turn pages the right way up, for one file or a whole batch at once.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "turn orientation flip sideways landscape"
  },
  {
    "id": "crop",
    "slug": "crop-pdf",
    "name": "Crop PDF",
    "desc": "Trim the margins of every page, with a live preview.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "trim margins cut edges whitespace"
  },
  {
    "id": "pagenum",
    "slug": "add-page-numbers-to-pdf",
    "name": "Page numbers",
    "desc": "Number your pages with the position, format and size you choose.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "numbering paginate pagination footer header count"
  },
  {
    "id": "watermark",
    "slug": "watermark-pdf",
    "name": "Watermark PDF",
    "desc": "Stamp text across your pages. Choose size, angle, colour and opacity.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "stamp confidential draft overlay brand"
  },
  {
    "id": "sign",
    "slug": "sign-pdf",
    "name": "Sign PDF",
    "desc": "Draw or type your signature and place it on the page.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "signature esign e-sign autograph initial"
  },
  {
    "id": "pdf2jpg",
    "slug": "pdf-to-jpg",
    "name": "PDF to JPG",
    "desc": "Save every page as a sharp JPG or PNG image.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "jpeg png image picture export pages photo"
  },
  {
    "id": "jpg2pdf",
    "slug": "jpg-to-pdf",
    "name": "JPG to PDF",
    "desc": "Turn photos and images into a PDF with the page size and margins you choose.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "jpeg png image photo picture webp convert"
  },
  {
    "id": "scan",
    "slug": "scan-to-pdf",
    "name": "Scan to PDF",
    "desc": "Use your phone or webcam to capture paper documents as a clean PDF.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "camera photo phone paper capture document scanner"
  },
  {
    "id": "pdf2md",
    "slug": "pdf-to-markdown",
    "name": "PDF to Markdown",
    "desc": "Get clean Markdown with headings and lists, ready for notes, docs and AI tools.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "md markdown text llm notes ai plain extract"
  },
  {
    "id": "compare",
    "slug": "compare-pdf",
    "name": "Compare PDF",
    "desc": "See exactly what changed between two versions of a document.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "diff difference versions changes review"
  },
  {
    "id": "aadhaar",
    "slug": "aadhaar-card-print",
    "name": "Aadhaar Card Print",
    "desc": "Put the front and back of your e-Aadhaar on one A4 page at real card size, ready to print and cut.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "aadhaar aadhar uidai e-aadhaar print a4 card size front back pvc cut"
  },
  {
    "id": "idcard",
    "slug": "id-card-print",
    "name": "ID Card Print",
    "desc": "Print both sides of a voter ID, driving licence, PAN or any card on one page at real card size.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "voter id pan card driving licence license both sides print a4 copy photocopy"
  },
  {
    "id": "interleave",
    "slug": "interleave-pdf",
    "name": "Interleave PDF",
    "desc": "Merge separately scanned front and back pages into one PDF in the right order.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "odd even duplex scan merge alternate shuffle collate front back"
  },
  {
    "id": "splithalf",
    "slug": "split-scanned-pages-in-half",
    "name": "Split Pages in Half",
    "desc": "Cut two-page scans of books down the middle into separate pages.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "book scan double page spread divide half vertical horizontal"
  },
  {
    "id": "removeblank",
    "slug": "remove-blank-pages-from-pdf",
    "name": "Remove Blank Pages",
    "desc": "Find and delete empty pages automatically, with a sensitivity you control.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "empty white pages delete clean scan duplex"
  },
  {
    "id": "nup",
    "slug": "n-up-pdf",
    "name": "Pages per Sheet (N-up)",
    "desc": "Put 2, 4, 6 or 9 pages on each sheet to save paper when printing.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "n-up 2up 4up multiple pages per sheet print handout save paper"
  },
  {
    "id": "booklet",
    "slug": "pdf-booklet-maker",
    "name": "Booklet Maker",
    "desc": "Rearrange pages so the printed sheets fold into a booklet.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "booklet saddle stitch fold imposition print zine brochure"
  },
  {
    "id": "bates",
    "slug": "bates-numbering",
    "name": "Bates Numbering",
    "desc": "Stamp legal-style numbers like ABC-000001 across one or many PDFs.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "bates legal numbering exhibit discovery stamp prefix"
  },
  {
    "id": "headerfooter",
    "slug": "add-header-and-footer-to-pdf",
    "name": "Header & Footer",
    "desc": "Add text, page numbers, the date or the file name to the top or bottom of every page.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "header footer text date title running head letterhead"
  },
  {
    "id": "metadata",
    "slug": "edit-pdf-metadata",
    "name": "Edit PDF Metadata",
    "desc": "Change or remove the title, author, subject and keywords stored inside a PDF.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "metadata properties title author remove privacy xmp keywords"
  },
  {
    "id": "flatten",
    "slug": "flatten-pdf",
    "name": "Flatten PDF",
    "desc": "Lock filled-in form fields and annotations so nobody can change them.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "flatten form fields lock annotations fillable final"
  },
  {
    "id": "extractimg",
    "slug": "extract-images-from-pdf",
    "name": "Extract Images",
    "desc": "Save every picture inside a PDF as a separate image file.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "extract images pictures photos get save export embedded"
  },
  {
    "id": "resizepages",
    "slug": "resize-pdf-pages",
    "name": "Resize PDF Pages",
    "desc": "Make every page A4, Letter, A3 or A5, with the content scaled to fit.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "page size a4 letter a3 a5 scale fit paper"
  },
  {
    "id": "pageops",
    "slug": "reverse-pdf-pages",
    "name": "Reverse & Insert Pages",
    "desc": "Reverse the page order, duplicate pages or insert blank pages.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "reverse order backwards duplicate copy insert blank page add empty"
  },
  {
    "id": "pdf2txt",
    "slug": "pdf-to-text",
    "name": "PDF to Text",
    "desc": "Copy all the text out of a PDF into a plain .txt file.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "text txt extract copy words plain"
  },
  {
    "id": "invert",
    "slug": "invert-pdf-colors",
    "name": "Dark Mode PDF",
    "desc": "Invert colours or switch to greyscale for comfortable reading at night.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "dark mode night invert colors negative greyscale grayscale black"
  },
  {
    "id": "stamp",
    "slug": "add-stamp-to-pdf",
    "name": "Add Image or Stamp",
    "desc": "Place a logo, stamp, seal or photo on your PDF pages.",
    "cat": "pdf",
    "exec": "browser",
    "keys": "stamp seal logo image picture add insert company mohar"
  },
  {
    "id": "imgcompress",
    "slug": "compress-image",
    "name": "Compress Image",
    "desc": "Shrink JPG, PNG and WebP photos for the web, email and uploads.",
    "cat": "image",
    "exec": "browser",
    "keys": "image photo picture smaller reduce size kb jpg png webp optimize"
  },
  {
    "id": "imgresize",
    "slug": "resize-image",
    "name": "Resize Image",
    "desc": "Change the size of photos in pixels or by percentage, one or many at once.",
    "cat": "image",
    "exec": "browser",
    "keys": "image photo dimensions pixels scale width height smaller bigger"
  },
  {
    "id": "imgconvert",
    "slug": "convert-image",
    "name": "Convert Image",
    "desc": "Change photos between JPG, PNG and WebP.",
    "cat": "image",
    "exec": "browser",
    "keys": "image format jpg jpeg png webp gif bmp convert change"
  },
  {
    "id": "imgcrop",
    "slug": "crop-image",
    "name": "Crop Image",
    "desc": "Cut photos to a square, 16:9 or any shape, with a live preview.",
    "cat": "image",
    "exec": "browser",
    "keys": "image photo cut trim square aspect ratio instagram"
  },
  {
    "id": "jpg2png",
    "slug": "jpg-to-png",
    "name": "JPG to PNG",
    "desc": "Turn JPG photos into lossless PNG images.",
    "cat": "image",
    "exec": "browser",
    "keys": "jpeg jpg png convert lossless"
  },
  {
    "id": "png2jpg",
    "slug": "png-to-jpg",
    "name": "PNG to JPG",
    "desc": "Turn PNG images into smaller JPG files. Transparent areas become white.",
    "cat": "image",
    "exec": "browser",
    "keys": "png jpg jpeg convert smaller transparent"
  },
  {
    "id": "imgkb",
    "slug": "compress-image-to-20kb",
    "name": "Compress Image to KB",
    "desc": "Make a photo exactly 20 KB, 50 KB, 100 KB or any size you need for online forms.",
    "cat": "image",
    "exec": "browser",
    "keys": "compress 20kb 50kb 100kb 200kb kb size exact form upload government reduce"
  },
  {
    "id": "examphoto",
    "slug": "exam-form-photo-signature-resizer",
    "name": "Exam Photo & Signature Resizer",
    "desc": "Resize a photo or signature to the exact pixel size and KB limit an exam form asks for.",
    "cat": "image",
    "exec": "browser",
    "keys": "ssc upsc neet jee ibps exam form photo signature resize kb pixels application"
  },
  {
    "id": "passport",
    "slug": "passport-size-photo-maker",
    "name": "Passport Photo Maker",
    "desc": "Crop a photo to passport size and print several copies on one 4×6 or A4 sheet.",
    "cat": "image",
    "exec": "browser",
    "keys": "passport size photo visa 35x45 2x2 print sheet copies id photo"
  },
  {
    "id": "heic2jpg",
    "slug": "heic-to-jpg",
    "name": "HEIC to JPG",
    "desc": "Convert iPhone HEIC photos into JPG or PNG that open everywhere.",
    "cat": "image",
    "exec": "browser",
    "keys": "heic heif iphone apple photo jpg convert ios"
  },
  {
    "id": "exif",
    "slug": "remove-exif-data",
    "name": "Remove Photo Location",
    "desc": "Strip GPS location, camera details and other hidden data from photos before you share them.",
    "cat": "image",
    "exec": "browser",
    "keys": "exif metadata gps location remove privacy camera strip"
  },
  {
    "id": "imgwatermark",
    "slug": "watermark-image",
    "name": "Watermark Image",
    "desc": "Add your name or brand to photos, once or tiled across the picture.",
    "cat": "image",
    "exec": "browser",
    "keys": "watermark text copyright brand logo protect photo"
  },
  {
    "id": "imgrotate",
    "slug": "rotate-image",
    "name": "Rotate & Flip Image",
    "desc": "Turn photos the right way up or mirror them.",
    "cat": "image",
    "exec": "browser",
    "keys": "rotate flip mirror turn image photo 90 180"
  },
  {
    "id": "imgblur",
    "slug": "blur-image",
    "name": "Blur Part of Image",
    "desc": "Hide faces, number plates or private details by blurring or pixelating an area.",
    "cat": "image",
    "exec": "browser",
    "keys": "blur pixelate hide face censor number plate private redact"
  },
  {
    "id": "collage",
    "slug": "combine-images",
    "name": "Combine Images",
    "desc": "Join photos side by side, stacked or in a grid, with the spacing you like.",
    "cat": "image",
    "exec": "browser",
    "keys": "collage combine join merge images side by side grid stitch"
  },
  {
    "id": "favicon",
    "slug": "favicon-generator",
    "name": "Favicon Generator",
    "desc": "Create favicon.ico and app icons in every size a website needs.",
    "cat": "image",
    "exec": "browser",
    "keys": "favicon ico icon website apple touch android pwa"
  },
  {
    "id": "svg2png",
    "slug": "svg-to-png",
    "name": "SVG to PNG",
    "desc": "Turn SVG graphics into PNG images at the size you choose.",
    "cat": "image",
    "exec": "browser",
    "keys": "svg png vector convert logo icon raster"
  },
  {
    "id": "img2svg",
    "slug": "png-to-svg",
    "name": "PNG & JPG to SVG",
    "desc": "Turn logos, icons and signatures into sharp SVG vector files that scale to any size.",
    "cat": "image",
    "exec": "browser",
    "keys": "png to svg jpg to svg jpeg to svg vectorize vector trace logo icon signature stamp line art convert scalable"
  },
  {
    "id": "palette",
    "slug": "color-palette-from-image",
    "name": "Colour Palette from Image",
    "desc": "Pull the main colours out of a photo as HEX and RGB codes.",
    "cat": "image",
    "exec": "browser",
    "keys": "color colour palette picker hex rgb extract dominant scheme"
  },
  {
    "id": "base64",
    "slug": "image-to-base64",
    "name": "Image to Base64",
    "desc": "Get a Base64 data URI of an image for HTML, CSS or JSON.",
    "cat": "image",
    "exec": "browser",
    "keys": "base64 data uri encode html css developer"
  },
  {
    "id": "imgborder",
    "slug": "add-border-to-image",
    "name": "Add Border to Image",
    "desc": "Give photos a coloured border and rounded corners.",
    "cat": "image",
    "exec": "browser",
    "keys": "border frame rounded corners radius outline photo"
  },
  {
    "id": "word2pdf",
    "slug": "word-to-pdf",
    "name": "Word to PDF",
    "desc": "Convert DOC and DOCX files into PDFs that look the same everywhere.",
    "cat": "converter",
    "exec": "server",
    "keys": "docx doc word microsoft office"
  },
  {
    "id": "excel2pdf",
    "slug": "excel-to-pdf",
    "name": "Excel to PDF",
    "desc": "Convert spreadsheets into PDFs with tidy, readable pages.",
    "cat": "converter",
    "exec": "server",
    "keys": "xlsx xls csv spreadsheet sheet table"
  },
  {
    "id": "ppt2pdf",
    "slug": "powerpoint-to-pdf",
    "name": "PowerPoint to PDF",
    "desc": "Turn PPT and PPTX slide decks into PDFs that are easy to share.",
    "cat": "converter",
    "exec": "server",
    "keys": "pptx ppt slides presentation deck"
  },
  {
    "id": "pdf2word",
    "slug": "pdf-to-word",
    "name": "PDF to Word",
    "desc": "Turn PDFs into editable Word documents that keep the layout.",
    "cat": "converter",
    "exec": "server",
    "keys": "docx doc word editable microsoft office"
  },
  {
    "id": "pdf2excel",
    "slug": "pdf-to-excel",
    "name": "PDF to Excel",
    "desc": "Pull tables out of PDFs straight into Excel spreadsheets.",
    "cat": "converter",
    "exec": "server",
    "keys": "xlsx xls csv table spreadsheet data extract"
  },
  {
    "id": "pdf2ppt",
    "slug": "pdf-to-powerpoint",
    "name": "PDF to PowerPoint",
    "desc": "Turn each PDF page into a PowerPoint slide, ready to present.",
    "cat": "converter",
    "exec": "server",
    "keys": "pptx ppt slides presentation deck"
  },
  {
    "id": "html2pdf",
    "slug": "html-to-pdf",
    "name": "HTML to PDF",
    "desc": "Enter a web page address and save that page as a PDF.",
    "cat": "converter",
    "exec": "server",
    "keys": "web page website url link html save"
  },
  {
    "id": "code2pdf",
    "slug": "html-code-to-pdf",
    "name": "HTML Code to PDF",
    "desc": "Paste HTML and CSS, see the live preview, and download it as a PDF.",
    "cat": "converter",
    "exec": "server",
    "keys": "html code css source markup render invoice template resume print"
  },
  {
    "id": "compress",
    "slug": "compress-pdf",
    "name": "Compress PDF",
    "desc": "Make PDFs smaller for email and uploads while keeping them readable.",
    "cat": "optimizer",
    "exec": "hybrid",
    "keys": "shrink reduce size smaller optimize email kb mb"
  },
  {
    "id": "repair",
    "slug": "repair-pdf",
    "name": "Repair PDF",
    "desc": "Recover what you can from a damaged or corrupt PDF.",
    "cat": "optimizer",
    "exec": "hybrid",
    "keys": "fix broken corrupt damaged recover"
  },
  {
    "id": "ocr",
    "slug": "ocr-pdf",
    "name": "OCR PDF",
    "desc": "Turn scanned PDFs into searchable text you can select and copy.",
    "cat": "optimizer",
    "exec": "server",
    "keys": "scan text recognition searchable selectable hindi"
  },
  {
    "id": "pdfa",
    "slug": "pdf-to-pdf-a",
    "name": "PDF to PDF/A",
    "desc": "Convert to PDF/A, the ISO standard for long-term archiving.",
    "cat": "optimizer",
    "exec": "server",
    "keys": "archive iso standard long term pdfa"
  },
  {
    "id": "protect",
    "slug": "protect-pdf",
    "name": "Protect PDF",
    "desc": "Add a password so only the right people can open the file.",
    "cat": "security",
    "exec": "server",
    "keys": "password encrypt lock secure"
  },
  {
    "id": "unlock",
    "slug": "unlock-pdf",
    "name": "Unlock PDF",
    "desc": "Remove the password from a PDF you are allowed to open.",
    "cat": "security",
    "exec": "server",
    "keys": "remove password decrypt open aadhaar"
  },
  {
    "id": "redact",
    "slug": "redact-pdf",
    "name": "Redact PDF",
    "desc": "Permanently black out names, numbers and other sensitive text.",
    "cat": "security",
    "exec": "server",
    "keys": "black out censor hide remove sensitive private gdpr"
  },
  {
    "id": "forms",
    "slug": "pdf-forms",
    "name": "PDF Forms",
    "desc": "Detect form fields automatically and turn flat PDFs into fillable forms.",
    "cat": "editor",
    "exec": "server",
    "keys": "fillable fields checkbox form fill acroform"
  },
  {
    "id": "edit",
    "slug": "edit-pdf",
    "name": "Edit PDF",
    "desc": "Add text, images, shapes and freehand notes to any page.",
    "cat": "editor",
    "exec": "server",
    "keys": "annotate text add write draw shapes modify",
    "pending": true
  },
  {
    "id": "summarize",
    "slug": "ai-pdf-summarizer",
    "name": "AI Summarizer",
    "desc": "Get the key points of a long document in seconds.",
    "cat": "ai",
    "exec": "server",
    "keys": "summary tldr ai key points digest abstract"
  },
  {
    "id": "translate",
    "slug": "translate-pdf",
    "name": "Translate PDF",
    "desc": "Translate PDFs into another language while keeping the text structure.",
    "cat": "ai",
    "exec": "server",
    "keys": "language translation ai hindi spanish french"
  }
];

export const TOOL_COUNT = TOOLS.length;
/** Browser-based: run on the phone (Compress and Repair PDF run in the browser too, with an optional server mode). */
export const DEVICE_TOOL_COUNT = TOOLS.filter(t => t.exec !== 'server').length;
/** API-based: need the Fileora processing server. */
export const API_TOOL_COUNT = TOOLS.filter(t => t.exec === 'server').length;

/** API-based tools stay switched off (maintenance message) until the server is live: see API_TOOLS_LIVE. */
export function isApiTool(t: Tool): boolean {
  return t.exec === 'server';
}
export function isAvailable(t: Tool): boolean {
  return !t.pending && (!isApiTool(t) || API_TOOLS_LIVE);
}

export function toolById(id: string): Tool | undefined {
  return TOOLS.find(t => t.id === id);
}

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find(c => c.id === id);
}

/** Popular tools on the home screen (in this order). */
export const POPULAR = ['merge', 'compress', 'word2pdf', 'jpg2pdf', 'pdf2word', 'imgresize', 'imgkb', 'ocr']
  .map(toolById)
  .filter((t): t is Tool => !!t);
