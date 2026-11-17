
import asyncio
import os
import shutil
import subprocess
import tempfile
import csv
import base64
from pathlib import Path

import httpx

from pdf2docx import Converter
from openpyxl import load_workbook

from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="JScan API")


# =========================================================
# CORS CONFIGURATION
# =========================================================

ALLOWED_ORIGINS = [
    "https://jscanit.pages.dev",
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5501",
    "http://127.0.0.1:5501"
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# =========================================================
# CONFIGURATION
# =========================================================

MAX_UPLOAD_SIZE = 200 * 1024 * 1024

# Google Cloud Vision image upload limit for this endpoint.
HANDWRITING_MAX_UPLOAD_SIZE = 20 * 1024 * 1024

GOOGLE_CLOUD_VISION_API_KEY = os.getenv(
    "GOOGLE_CLOUD_VISION_API_KEY",
    ""
)

GOOGLE_CLOUD_VISION_URL = (
    "https://vision.googleapis.com/v1/images:annotate"
)

ALLOWED_HANDWRITING_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp"
}

# Read the Gotenberg address from Railway environment variables.
# The fallback is for local development only.
GOTENBERG_URL = os.getenv(
    "GOTENBERG_URL",
    "http://localhost:3000"
).rstrip("/")


QUALITY_SETTINGS = {
    "printer": {
        "target_reduction": 0.20,
        "profiles": ["/prepress", "/printer", "/ebook"]
    },
    "ebook": {
        "target_reduction": 0.50,
        "profiles": ["/printer", "/ebook", "/screen"]
    },
    "screen": {
        "target_reduction": 0.80,
        "profiles": ["/ebook", "/screen"]
    },
    "high": {
        "target_reduction": 0.20,
        "profiles": ["/prepress", "/printer", "/ebook"]
    },
    "balanced": {
        "target_reduction": 0.50,
        "profiles": ["/printer", "/ebook", "/screen"]
    },
    "maximum": {
        "target_reduction": 0.80,
        "profiles": ["/ebook", "/screen"]
    }
}


EXCEL_MIME_TYPES = {
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".csv": "text/csv"
}


WORD_MIME_TYPE = (
    "application/vnd.openxmlformats-officedocument."
    "wordprocessingml.document"
)


@app.get("/")
def home():
    return {
        "message": "JScan API is running",
        "services": [
            "Ghostscript PDF Compression",
            "Gotenberg Word-to-PDF",
            "PDF-to-Word Conversion",
            "Excel-to-Word Conversion",
            "Excel-to-PDF Conversion",
            "Google Cloud Vision Handwriting Recognition"
        ]
    }


# =========================================================
# HANDWRITING TO TEXT
# =========================================================

@app.post("/handwriting-to-text")
async def handwriting_to_text(file: UploadFile = File(...)):

    if not GOOGLE_CLOUD_VISION_API_KEY:
        raise HTTPException(
            503,
            "Handwriting recognition is not configured yet."
        )

    if not file.filename:
        raise HTTPException(
            400,
            "Please upload an image."
        )

    content_type = (file.content_type or "").lower().split(";")[0].strip()

    if content_type not in ALLOWED_HANDWRITING_TYPES:
        raise HTTPException(
            400,
            "Please upload a JPG, PNG, or WebP image."
        )

    try:

        image_data = await file.read(
            HANDWRITING_MAX_UPLOAD_SIZE + 1
        )

        if not image_data:
            raise HTTPException(
                400,
                "The uploaded image is empty."
            )

        if len(image_data) > HANDWRITING_MAX_UPLOAD_SIZE:
            raise HTTPException(
                413,
                "Image exceeds the 20 MB upload limit."
            )

        encoded_image = base64.b64encode(
            image_data
        ).decode("utf-8")

        request_payload = {
            "requests": [
                {
                    "image": {
                        "content": encoded_image
                    },
                    "features": [
                        {
                            "type": "DOCUMENT_TEXT_DETECTION"
                        }
                    ]
                }
            ]
        }

        async with httpx.AsyncClient(timeout=90.0) as client:

            response = await client.post(
                GOOGLE_CLOUD_VISION_URL,
                params={
                    "key": GOOGLE_CLOUD_VISION_API_KEY
                },
                json=request_payload
            )

        if response.status_code != 200:

            print(
                "Google Cloud Vision error:",
                response.status_code,
                response.text[:1000]
            )

            if response.status_code in (401, 403):
                raise HTTPException(
                    502,
                    "Handwriting recognition authentication failed. Please contact support."
                )

            if response.status_code == 429:
                raise HTTPException(
                    503,
                    "Handwriting recognition is temporarily unavailable. Please try again later."
                )

            raise HTTPException(
                502,
                "Could not process the handwriting image. Please try again."
            )

        result = response.json()

        responses = result.get("responses", [])

        if not responses:
            raise HTTPException(
                422,
                "No handwriting recognition result was returned."
            )

        vision_result = responses[0]

        if vision_result.get("error"):
            print(
                "Google Cloud Vision processing error:",
                vision_result["error"]
            )

            raise HTTPException(
                422,
                "Could not recognize the text in this image. Please try another image."
            )

        full_text = (
            vision_result
            .get("fullTextAnnotation", {})
            .get("text", "")
            .strip()
        )

        if not full_text:
            raise HTTPException(
                422,
                "No readable handwriting was found in this image."
            )

        return {
            "success": True,
            "filename": Path(file.filename).name,
            "text": full_text,
            "message": "Handwriting recognized successfully."
        }

    except HTTPException:
        raise

    except httpx.TimeoutException:

        raise HTTPException(
            504,
            "Handwriting recognition took too long. Please try again."
        )

    except httpx.RequestError as error:

        print(
            "Google Cloud Vision connection error:",
            repr(error)
        )

        raise HTTPException(
            502,
            "Could not connect to the handwriting recognition service."
        )

    except Exception as error:

        print(
            "JScan handwriting recognition error:",
            repr(error)
        )

        raise HTTPException(
            500,
            "An error occurred while recognizing the handwriting."
        )

    finally:

        await file.close()


# =========================================================
# PDF COMPRESSION
# =========================================================

def run_ghostscript(input_path, output_path, profile):

    command = [
        "gs",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={profile}",
        "-dNOPAUSE",
        "-dBATCH",
        "-dSAFER",
        "-dQUIET",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        "-dSubsetFonts=true",
        "-sOutputFile=" + str(output_path),
        str(input_path)
    ]

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=180
    )

    return (
        result.returncode == 0
        and output_path.exists()
        and output_path.stat().st_size > 0
    )


@app.post("/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    quality: str = "ebook"
):

    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(400, "Please upload a PDF file.")

    if quality not in QUALITY_SETTINGS:
        raise HTTPException(400, "Invalid compression quality.")

    settings = QUALITY_SETTINGS[quality]
    target_reduction = settings["target_reduction"]

    temp_dir = tempfile.mkdtemp()
    cleanup_scheduled = False

    try:

        input_path = Path(temp_dir) / "input.pdf"
        output_path = Path(temp_dir) / "compressed.pdf"

        total_size = 0

        with input_path.open("wb") as output_file:

            while True:

                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        413,
                        "PDF exceeds the 200 MB upload limit."
                    )

                output_file.write(chunk)

        if total_size == 0:
            raise HTTPException(400, "The uploaded PDF is empty.")

        target_size = total_size * (1 - target_reduction)

        best_path = None
        best_score = None

        for index, profile in enumerate(settings["profiles"]):

            attempt_path = Path(temp_dir) / f"attempt_{index}.pdf"

            try:
                success = run_ghostscript(
                    input_path,
                    attempt_path,
                    profile
                )

            except subprocess.TimeoutExpired:
                continue

            if not success:
                continue

            compressed_size = attempt_path.stat().st_size

            if compressed_size >= total_size:
                continue

            score = (
                abs(compressed_size - target_size),
                0 if compressed_size >= target_size else 1
            )

            if best_score is None or score < best_score:
                best_score = score
                best_path = attempt_path

        if best_path is None:
            shutil.copy2(input_path, output_path)
        else:
            shutil.copy2(best_path, output_path)

        response = FileResponse(
            path=str(output_path),
            media_type="application/pdf",
            filename="JScan-Compressed.pdf",
            background=BackgroundTask(
                shutil.rmtree,
                temp_dir,
                ignore_errors=True
            )
        )

        cleanup_scheduled = True
        return response

    except HTTPException:
        raise

    except Exception as error:

        print("JScan compression error:", repr(error))

        raise HTTPException(
            500,
            "An error occurred while compressing this PDF."
        )

    finally:

        await file.close()

        if not cleanup_scheduled:
            shutil.rmtree(temp_dir, ignore_errors=True)


# =========================================================
# WORD TO PDF
# =========================================================

@app.post("/word-to-pdf")
async def word_to_pdf(file: UploadFile = File(...)):

    if not file.filename or Path(file.filename).suffix.lower() != ".docx":
        raise HTTPException(
            400,
            "Please upload a valid DOCX Word document."
        )

    temp_dir = tempfile.mkdtemp()
    cleanup_scheduled = False

    try:

        input_path = Path(temp_dir) / Path(file.filename).name

        total_size = 0

        with input_path.open("wb") as output_file:

            while True:

                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        413,
                        "Word document exceeds the 200 MB upload limit."
                    )

                output_file.write(chunk)

        if total_size == 0:
            raise HTTPException(
                400,
                "The uploaded Word document is empty."
            )

        async with httpx.AsyncClient(timeout=180.0) as client:

            with input_path.open("rb") as word_file:

                response = await client.post(
                    f"{GOTENBERG_URL}/forms/libreoffice/convert",
                    files={
                        "files": (
                            Path(file.filename).name,
                            word_file,
                            WORD_MIME_TYPE
                        )
                    }
                )

        if response.status_code != 200:

            print(
                "Gotenberg conversion error:",
                response.status_code,
                response.text[:1000]
            )

            raise HTTPException(
                502,
                "Word-to-PDF conversion failed. Please try again."
            )

        if not response.content.startswith(b"%PDF"):
            raise HTTPException(
                502,
                "The conversion service returned an invalid PDF."
            )

        output_path = Path(temp_dir) / "converted.pdf"
        output_path.write_bytes(response.content)

        download_name = f"{Path(file.filename).stem}.pdf"

        result = FileResponse(
            path=str(output_path),
            media_type="application/pdf",
            filename=download_name,
            background=BackgroundTask(
                shutil.rmtree,
                temp_dir,
                ignore_errors=True
            )
        )

        cleanup_scheduled = True
        return result

    except HTTPException:
        raise

    except httpx.RequestError as error:

        print("Gotenberg connection error:", repr(error))

        raise HTTPException(
            502,
            "Could not connect to the Word conversion service."
        )

    except Exception as error:

        print("JScan Word-to-PDF error:", repr(error))

        raise HTTPException(
            500,
            "An error occurred while converting this Word document."
        )

    finally:

        await file.close()

        if not cleanup_scheduled:
            shutil.rmtree(temp_dir, ignore_errors=True)


# =========================================================
# PDF TO WORD
# =========================================================

def convert_pdf_to_docx(input_path, output_path):

    converter = Converter(str(input_path))

    try:
        converter.convert(str(output_path))
    finally:
        converter.close()

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError(
            "The DOCX conversion produced an empty file."
        )


@app.post("/pdf-to-word")
async def pdf_to_word(file: UploadFile = File(...)):

    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(
            400,
            "Please upload a valid PDF file."
        )

    temp_dir = tempfile.mkdtemp()
    cleanup_scheduled = False

    try:

        safe_filename = Path(file.filename).name
        input_path = Path(temp_dir) / "input.pdf"

        total_size = 0

        with input_path.open("wb") as output_file:

            while True:

                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        413,
                        "PDF exceeds the 200 MB upload limit."
                    )

                output_file.write(chunk)

        if total_size == 0:
            raise HTTPException(
                400,
                "The uploaded PDF is empty."
            )

        with input_path.open("rb") as pdf_file:

            if pdf_file.read(5) != b"%PDF-":
                raise HTTPException(
                    400,
                    "The uploaded file does not appear to be a valid PDF."
                )

        output_path = Path(temp_dir) / "converted.docx"

        try:

            await asyncio.to_thread(
                convert_pdf_to_docx,
                input_path,
                output_path
            )

        except Exception as error:

            print("PDF-to-Word conversion error:", repr(error))

            raise HTTPException(
                422,
                "Could not convert this PDF. It may be scanned, damaged, or contain unsupported content."
            )

        download_name = f"{Path(safe_filename).stem}.docx"

        result = FileResponse(
            path=str(output_path),
            media_type=WORD_MIME_TYPE,
            filename=download_name,
            background=BackgroundTask(
                shutil.rmtree,
                temp_dir,
                ignore_errors=True
            )
        )

        cleanup_scheduled = True
        return result

    except HTTPException:
        raise

    except Exception as error:

        print("JScan PDF-to-Word error:", repr(error))

        raise HTTPException(
            500,
            "An error occurred while converting this PDF."
        )

    finally:

        await file.close()

        if not cleanup_scheduled:
            shutil.rmtree(temp_dir, ignore_errors=True)


# =========================================================
# EXCEL FILE READING
# =========================================================

def excel_value_to_text(value):

    if value is None:
        return ""

    return str(value)


def read_excel_sheets(input_path, extension):

    sheets = []

    if extension == ".xlsx":

        workbook = load_workbook(
            input_path,
            read_only=True,
            data_only=True
        )

        try:

            for worksheet in workbook.worksheets:

                rows = [
                    [
                        excel_value_to_text(value)
                        for value in row
                    ]
                    for row in worksheet.iter_rows(values_only=True)
                ]

                sheets.append((worksheet.title, rows))

        finally:
            workbook.close()

    elif extension == ".xls":

        import xlrd

        workbook = xlrd.open_workbook(str(input_path))

        for worksheet in workbook.sheets():

            rows = [
                [
                    excel_value_to_text(
                        worksheet.cell_value(row_index, column_index)
                    )
                    for column_index in range(worksheet.ncols)
                ]
                for row_index in range(worksheet.nrows)
            ]

            sheets.append((worksheet.name, rows))

    elif extension == ".csv":

        with input_path.open(
            "r",
            encoding="utf-8-sig",
            newline=""
        ) as csv_file:

            sample = csv_file.read(8192)
            csv_file.seek(0)

            try:
                dialect = csv.Sniffer().sniff(sample)
            except csv.Error:
                dialect = csv.excel

            rows = list(csv.reader(csv_file, dialect))

        sheets.append(("CSV Data", rows))

    return sheets


# =========================================================
# EXCEL TO WORD
# =========================================================

def create_excel_word_document(input_path, output_path, extension):

    document = Document()

    section = document.sections[0]

    section.top_margin = Inches(0.6)
    section.bottom_margin = Inches(0.6)
    section.left_margin = Inches(0.6)
    section.right_margin = Inches(0.6)

    document.styles["Normal"].font.name = "Arial"
    document.styles["Normal"].font.size = Pt(9)

    sheets = read_excel_sheets(input_path, extension)

    if not sheets:
        raise ValueError("No worksheets or data found.")

    for sheet_index, (sheet_name, rows) in enumerate(sheets):

        if sheet_index > 0:
            document.add_page_break()

        heading = document.add_heading(sheet_name, level=1)
        heading.alignment = WD_ALIGN_PARAGRAPH.LEFT

        if not rows:
            document.add_paragraph("This worksheet is empty.")
            continue

        max_columns = max(
            (len(row) for row in rows),
            default=0
        )

        if max_columns == 0:
            document.add_paragraph("This worksheet is empty.")
            continue

        table = document.add_table(
            rows=0,
            cols=max_columns
        )

        table.style = "Table Grid"
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = True

        for row_index, row_data in enumerate(rows):

            cells = table.add_row().cells

            for column_index in range(max_columns):

                value = (
                    row_data[column_index]
                    if column_index < len(row_data)
                    else ""
                )

                cell = cells[column_index]
                cell.text = excel_value_to_text(value)

                cell.vertical_alignment = (
                    WD_CELL_VERTICAL_ALIGNMENT.CENTER
                )

                for paragraph in cell.paragraphs:

                    paragraph.paragraph_format.space_after = Pt(2)

                    for run in paragraph.runs:

                        run.font.name = "Arial"
                        run.font.size = Pt(8)

                        if row_index == 0:
                            run.bold = True

    document.save(output_path)

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError(
            "Word document creation failed."
        )


@app.post("/excel-to-word")
async def excel_to_word(file: UploadFile = File(...)):

    extension = Path(file.filename or "").suffix.lower()

    if extension not in EXCEL_MIME_TYPES:
        raise HTTPException(
            400,
            "Please upload an XLSX, XLS, or CSV file."
        )

    temp_dir = tempfile.mkdtemp()
    cleanup_scheduled = False

    try:

        safe_filename = Path(file.filename).name

        input_path = Path(temp_dir) / safe_filename
        output_path = Path(temp_dir) / "converted.docx"

        total_size = 0

        with input_path.open("wb") as output_file:

            while True:

                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        413,
                        "Excel file exceeds the 200 MB upload limit."
                    )

                output_file.write(chunk)

        if total_size == 0:
            raise HTTPException(
                400,
                "The uploaded Excel file is empty."
            )

        await asyncio.to_thread(
            create_excel_word_document,
            input_path,
            output_path,
            extension
        )

        download_name = f"{Path(safe_filename).stem}.docx"

        result = FileResponse(
            path=str(output_path),
            media_type=WORD_MIME_TYPE,
            filename=download_name,
            background=BackgroundTask(
                shutil.rmtree,
                temp_dir,
                ignore_errors=True
            )
        )

        cleanup_scheduled = True
        return result

    except HTTPException:
        raise

    except Exception as error:

        print("Excel-to-Word conversion error:", repr(error))

        raise HTTPException(
            422,
            "Could not convert this Excel file. Please check that it is valid and try again."
        )

    finally:

        await file.close()

        if not cleanup_scheduled:
            shutil.rmtree(temp_dir, ignore_errors=True)


# =========================================================
# EXCEL TO PDF
# =========================================================

def prepare_excel_for_pdf(input_path, extension, output_path):
    """
    Create a clean, print-ready XLSX copy before sending it to
    LibreOffice/Gotenberg. XLSX keeps its cell values and existing
    workbook structure; XLS and CSV are first converted to XLSX.
    """
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
    from openpyxl.utils import get_column_letter

    if extension == ".xlsx":
        workbook = load_workbook(input_path)
    else:
        workbook = Workbook()
        default_sheet = workbook.active

        if extension == ".xls":
            import xlrd

            old_workbook = xlrd.open_workbook(str(input_path))

            for sheet_index, old_sheet in enumerate(old_workbook.sheets()):
                if sheet_index == 0:
                    worksheet = default_sheet
                    worksheet.title = old_sheet.name[:31] or "Sheet1"
                else:
                    worksheet = workbook.create_sheet(
                        title=old_sheet.name[:31] or f"Sheet{sheet_index + 1}"
                    )

                for row_index in range(old_sheet.nrows):
                    for column_index in range(old_sheet.ncols):
                        value = old_sheet.cell_value(row_index, column_index)
                        cell_type = old_sheet.cell_type(row_index, column_index)

                        if cell_type == xlrd.XL_CELL_DATE:
                            try:
                                value = xlrd.xldate_as_datetime(
                                    value, old_workbook.datemode
                                )
                            except (ValueError, OverflowError):
                                pass

                        worksheet.cell(
                            row=row_index + 1,
                            column=column_index + 1,
                            value=value
                        )

        elif extension == ".csv":
            with input_path.open(
                "r", encoding="utf-8-sig", newline=""
            ) as csv_file:
                sample = csv_file.read(8192)
                csv_file.seek(0)

                try:
                    dialect = csv.Sniffer().sniff(sample)
                except csv.Error:
                    dialect = csv.excel

                rows = csv.reader(csv_file, dialect)

                for row in rows:
                    default_sheet.append([
                        value if value != "" else None for value in row
                    ])

            default_sheet.title = "CSV Data"

        else:
            raise ValueError("Unsupported spreadsheet format.")

    thin_gray = Side(style="thin", color="B7C9D6")
    cell_border = Border(
        left=thin_gray,
        right=thin_gray,
        top=thin_gray,
        bottom=thin_gray
    )
    header_fill = PatternFill(
        fill_type="solid",
        fgColor="1D4ED8"
    )
    header_font = Font(
        name="Arial",
        size=10,
        bold=True,
        color="FFFFFF"
    )
    body_font = Font(
        name="Arial",
        size=9,
        color="1F2937"
    )

    for worksheet in workbook.worksheets:
        worksheet.sheet_view.showGridLines = False

        max_row = worksheet.max_row or 1
        max_column = worksheet.max_column or 1

        for row_index in range(1, max_row + 1):
            for column_index in range(1, max_column + 1):
                cell = worksheet.cell(row=row_index, column=column_index)
                cell.border = cell_border
                cell.alignment = Alignment(
                    vertical="center",
                    horizontal="left",
                    wrap_text=True
                )

                if row_index == 1:
                    cell.fill = header_fill
                    cell.font = header_font
                else:
                    cell.font = body_font

        for column_index in range(1, max_column + 1):
            longest = 0

            for row_index in range(1, max_row + 1):
                value = worksheet.cell(
                    row=row_index,
                    column=column_index
                ).value

                if value is not None:
                    longest = max(longest, len(str(value)))

            worksheet.column_dimensions[
                get_column_letter(column_index)
            ].width = min(max(longest + 3, 12), 40)

        for row_index in range(1, max_row + 1):
            worksheet.row_dimensions[row_index].height = 24 if row_index == 1 else 30

        worksheet.sheet_properties.pageSetUpPr.fitToPage = True
        worksheet.page_setup.orientation = (
            "landscape" if max_column > 5 else "portrait"
        )
        worksheet.page_setup.paperSize = worksheet.PAPERSIZE_A4
        worksheet.page_setup.fitToWidth = 1
        worksheet.page_setup.fitToHeight = 0
        worksheet.page_margins.left = 0.25
        worksheet.page_margins.right = 0.25
        worksheet.page_margins.top = 0.5
        worksheet.page_margins.bottom = 0.5
        worksheet.print_title_rows = "1:1"
        worksheet.sheet_properties.pageSetUpPr.autoPageBreaks = False

        if max_row and max_column:
            worksheet.print_area = (
                f"A1:{get_column_letter(max_column)}{max_row}"
            )

    workbook.save(output_path)
    workbook.close()

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError("Could not prepare the spreadsheet for PDF conversion.")


async def convert_excel_to_pdf(file: UploadFile):
    extension = Path(file.filename or "").suffix.lower()

    if extension not in EXCEL_MIME_TYPES:
        raise HTTPException(
            400,
            "Please upload an XLSX, XLS, or CSV file."
        )

    temp_dir = tempfile.mkdtemp()
    cleanup_scheduled = False

    try:
        safe_filename = Path(file.filename).name
        input_path = Path(temp_dir) / safe_filename
        prepared_path = Path(temp_dir) / "JScan-Formatted.xlsx"
        output_path = Path(temp_dir) / "converted.pdf"

        total_size = 0

        with input_path.open("wb") as output_file:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        413,
                        "Excel file exceeds the 200 MB upload limit."
                    )

                output_file.write(chunk)

        if total_size == 0:
            raise HTTPException(
                400,
                "The uploaded Excel file is empty."
            )

        try:
            await asyncio.to_thread(
                prepare_excel_for_pdf,
                input_path,
                extension,
                prepared_path
            )
        except Exception as error:
            print("Excel formatting error:", repr(error))
            raise HTTPException(
                422,
                "Could not read or format this spreadsheet. Please check the file and try again."
            )

        async with httpx.AsyncClient(timeout=300.0) as client:
            with prepared_path.open("rb") as excel_file:
                response = await client.post(
                    f"{GOTENBERG_URL}/forms/libreoffice/convert",
                    files={
                        "files": (
                            "JScan-Formatted.xlsx",
                            excel_file,
                            EXCEL_MIME_TYPES[".xlsx"]
                        )
                    }
                )

        if response.status_code != 200:
            print(
                "Gotenberg Excel-to-PDF error:",
                response.status_code,
                response.text[:1000]
            )
            raise HTTPException(
                502,
                "Excel-to-PDF conversion failed. Please try again."
            )

        if not response.content.startswith(b"%PDF"):
            raise HTTPException(
                502,
                "The conversion service returned an invalid PDF."
            )

        output_path.write_bytes(response.content)
        download_name = f"{Path(safe_filename).stem}.pdf"

        result = FileResponse(
            path=str(output_path),
            media_type="application/pdf",
            filename=download_name,
            background=BackgroundTask(
                shutil.rmtree,
                temp_dir,
                ignore_errors=True
            )
        )

        cleanup_scheduled = True
        return result

    except HTTPException:
        raise

    except httpx.RequestError as error:
        print("Gotenberg Excel connection error:", repr(error))
        raise HTTPException(
            502,
            "Could not connect to the Excel conversion service."
        )

    except Exception as error:
        print("Excel-to-PDF conversion error:", repr(error))
        raise HTTPException(
            500,
            "An error occurred while converting this Excel file."
        )

    finally:
        await file.close()

        if not cleanup_scheduled:
            shutil.rmtree(temp_dir, ignore_errors=True)


@app.post("/excel-to-pdf")
async def excel_to_pdf(file: UploadFile = File(...)):
    return await convert_excel_to_pdf(file)
