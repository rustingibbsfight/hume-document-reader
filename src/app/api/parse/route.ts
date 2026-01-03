import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (fileName.endsWith(".txt") || fileName.endsWith(".md")) {
      // Plain text files
      text = buffer.toString("utf-8");
    } else if (fileName.endsWith(".pdf")) {
      // PDF files
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(buffer);
        text = data.text;
      } catch (e: any) {
        console.error("PDF parse error:", e);
        return NextResponse.json(
          { error: "Failed to parse PDF", details: e.message },
          { status: 400 }
        );
      }
    } else if (fileName.endsWith(".docx")) {
      // Word documents
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch (e: any) {
        console.error("DOCX parse error:", e);
        return NextResponse.json(
          { error: "Failed to parse Word document", details: e.message },
          { status: 400 }
        );
      }
    } else if (fileName.endsWith(".html") || fileName.endsWith(".htm")) {
      // HTML files - extract text content
      const html = buffer.toString("utf-8");
      text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Supported: .txt, .md, .pdf, .docx, .html" },
        { status: 400 }
      );
    }

    // Clean up the text
    text = text
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({
      text,
      fileName: file.name,
      charCount: text.length,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });
  } catch (error: any) {
    console.error("File parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse file", details: error.message },
      { status: 500 }
    );
  }
}
