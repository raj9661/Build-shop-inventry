"use client"

import { useState, useEffect, useCallback, useRef, memo } from "react"
import { useLanguage } from "@/hooks/use-language"
import { useShop } from "@/app/contexts/ShopContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { UploadCloud, FileImage, Trash2, Download, RefreshCw, Eye, X, Sparkles, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_SIZE = 2 * 1024 * 1024  // 2 MB hard limit
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"])
const ALLOWED_MIME_TYPES  = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"])

// ─── Security: verify real file type by magic bytes ──────────────────────────
async function verifyMagicBytes(file: File): Promise<boolean> {
  const buf  = await file.slice(0, 12).arrayBuffer()
  const b    = new Uint8Array(buf)
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  const png  = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  const gif  = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
               b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  // HEIC: starts with ftyp box
  const heic = b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70
  return jpeg || png || gif || webp || heic
}

// ─── Security: reject double-extension spoofing (e.g. evil.py.jpg) ────────────
function hasDoubleExtension(name: string): boolean {
  const basename = name.split(/[\\/]/).pop() ?? name
  // count dots after the first char
  const dots = (basename.match(/\./g) ?? []).length
  return dots > 1
}

// ─── Image enhancement via Canvas API (client-side, no server round-trip) ────
async function enhanceAndCompress(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img  = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)

      // Start at a sane resolution; we'll shrink further if needed
      const MAX_DIM = 2400
      let { naturalWidth: w, naturalHeight: h } = img
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h)
        w = Math.round(w * ratio)
        h = Math.round(h * ratio)
      }

      const drawAndSharpen = (cw: number, ch: number): ImageData => {
        const canvas = document.createElement("canvas")
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, cw, ch)
        // Sharpening 3×3 kernel
        const id  = ctx.getImageData(0, 0, cw, ch)
        const src = new Uint8ClampedArray(id.data)
        const dst = id.data
        const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
        for (let y = 1; y < ch - 1; y++) {
          for (let x = 1; x < cw - 1; x++) {
            const idx = (y * cw + x) * 4
            for (let c = 0; c < 3; c++) {
              let val = 0
              for (let ky = -1; ky <= 1; ky++)
                for (let kx = -1; kx <= 1; kx++)
                  val += src[((y + ky) * cw + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)]
              dst[idx + c] = Math.max(0, Math.min(255, val))
            }
          }
        }
        ctx.putImageData(id, 0, 0)
        return id
      }

      // Quality ladder: try from best → acceptable until file fits under MAX_SIZE
      // If quality alone isn't enough we also halve dimensions each round
      const qualitySteps = [0.90, 0.80, 0.65, 0.50, 0.35]
      let stepIdx = 0
      let curW = w, curH = h
      let canvas = document.createElement("canvas")

      const attempt = () => {
        if (stepIdx >= qualitySteps.length) {
          // Last resort: halve dimensions and start over on quality ladder
          curW = Math.max(Math.round(curW / 2), 100)
          curH = Math.max(Math.round(curH / 2), 100)
          stepIdx = 2 // start at 0.65 after resize (already small)
        }

        // Redraw at current dimensions
        canvas = document.createElement("canvas")
        canvas.width  = curW
        canvas.height = curH
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, curW, curH)
        // Apply sharpening only on first attempt (expensive)
        if (stepIdx === 0) {
          const id  = ctx.getImageData(0, 0, curW, curH)
          const src = new Uint8ClampedArray(id.data)
          const dst = id.data
          const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
          for (let y = 1; y < curH - 1; y++)
            for (let x = 1; x < curW - 1; x++) {
              const idx = (y * curW + x) * 4
              for (let c = 0; c < 3; c++) {
                let val = 0
                for (let ky = -1; ky <= 1; ky++)
                  for (let kx = -1; kx <= 1; kx++)
                    val += src[((y + ky) * curW + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)]
                dst[idx + c] = Math.max(0, Math.min(255, val))
              }
            }
          ctx.putImageData(id, 0, 0)
        }

        const q = qualitySteps[Math.min(stepIdx, qualitySteps.length - 1)]
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error("Canvas toBlob failed")); return }
          if (blob.size <= MAX_SIZE) {
            // ✅ fits!
            const outName = file.name.replace(/\.[^.]+$/, ".jpg")
            resolve(new File([blob], outName, { type: "image/jpeg" }))
          } else {
            stepIdx++
            attempt()  // try next step
          }
        }, "image/jpeg", q)
      }

      attempt()
    }
    img.onerror = () => reject(new Error("Image load failed"))
    img.src = url
  })
}

// ─── Full client-side validation + enhancement pipeline ─────────────────────
async function processFile(raw: File): Promise<File | null> {
  const name = raw.name
  const ext  = (name.split(".").pop() ?? "").toLowerCase()

  if (hasDoubleExtension(name)) {
    toast.error("❌ Suspicious filename detected (e.g. file.py.jpg). Upload refused.")
    return null
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    toast.error(`❌ File extension ".${ext}" not allowed. Only images (JPG, PNG, WEBP…).`)
    return null
  }
  if (!ALLOWED_MIME_TYPES.has(raw.type)) {
    toast.error("❌ MIME type not recognised as an image.")
    return null
  }
  const genuine = await verifyMagicBytes(raw)
  if (!genuine) {
    toast.error("❌ File content doesn't match an image. Upload refused.")
    return null
  }
  if (raw.size > MAX_SIZE) {
    // Will be compressed below – just let it through
  }
  return raw
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface SaleDocument {
  id: string
  fileName: string
  originalName: string
  fileUrl: string | null
  fileSize: number
  mimeType: string
  documentDate: string
  description: string | null
  createdAt: string
  uploader: { name: string }
}

// ─── Memoised document card ──────────────────────────────────────────────────
const DocCard = memo(function DocCard({
  doc, onDelete, formatFileSize,
}: { doc: SaleDocument; onDelete: (id: string) => void; formatFileSize: (n: number) => string }) {
  return (
    <div className="border rounded-xl p-3 flex flex-col bg-gray-50 hover:bg-indigo-50/30 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className="bg-white px-2 py-1 rounded text-xs font-medium border text-gray-600 shadow-sm">
          {format(new Date(doc.documentDate), "dd MMM yyyy")}
        </div>
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={() => onDelete(doc.id)} title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center py-4 text-center px-2">
        {doc.fileUrl ? (
          <img
            src={doc.fileUrl}
            alt={doc.originalName}
            className="h-24 w-full object-cover rounded-lg mb-2 border"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <FileImage className="h-10 w-10 text-indigo-400 mb-2" />
        )}
        <h3 className="text-sm font-medium text-gray-800 line-clamp-1 break-all w-full" title={doc.originalName}>
          {doc.originalName}
        </h3>
        <p className="text-xs text-gray-500 mt-1">{formatFileSize(doc.fileSize)}</p>
        {doc.description && (
          <p className="text-xs text-gray-600 mt-2 bg-white w-full p-2 rounded border line-clamp-2" title={doc.description}>
            {doc.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t">
        {doc.fileUrl ? (
          <>
            <a
              href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 bg-white border rounded py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <Eye className="h-3 w-3" /> View
            </a>
            <a
              href={doc.fileUrl} download={doc.originalName}
              className="flex items-center justify-center gap-1 bg-indigo-50 border border-indigo-100 rounded py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
            >
              <Download className="h-3 w-3" /> Download
            </a>
          </>
        ) : (
          <div className="col-span-2 text-center text-xs text-gray-400 py-1.5 border rounded bg-gray-100">
            Link expired or unavailable
          </div>
        )}
      </div>
      <div className="text-[10px] text-gray-400 mt-2 text-right">
        Uploaded by {doc.uploader.name}
      </div>
    </div>
  )
})

// ─── Main page ───────────────────────────────────────────────────────────────
export default function SaleDocuments() {
  const { t } = useLanguage()
  const { currentShop, userRole } = useShop()

  const [documents,   setDocuments]   = useState<SaleDocument[]>([])
  const [loading,     setLoading]     = useState(true)
  const [page,        setPage]        = useState(1)
  const [totalPages,  setTotalPages]  = useState(1)
  const [dateFilter,  setDateFilter]  = useState("")

  // ── Helpers ─────────────────────────────────────────────────────────────
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024, sizes = ["B", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`
  }, [])

  // ── Fetch documents (stable reference) ──────────────────────────────────
  const fetchDocuments = useCallback(async (pageNum = 1) => {
    if (!currentShop?.id) return
    setLoading(true)
    try {
      const token = localStorage.getItem("accessToken")
      let url = `/api/sale-documents?shopId=${currentShop.id}&page=${pageNum}&limit=12`
      if (dateFilter) url += `&dateFrom=${dateFilter}&dateTo=${dateFilter}`
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        setDocuments(prev => pageNum === 1 ? data.data.documents : [...prev, ...data.data.documents])
        setTotalPages(data.data.pagination.totalPages)
        setPage(pageNum)
      } else toast.error(data.message || "Failed to load documents")
    } catch { toast.error("Error loading documents") }
    finally    { setLoading(false) }
  }, [currentShop?.id, dateFilter])

  useEffect(() => {
    if (userRole === "SUPER_DUPER_ADMIN" || userRole === "SUPER_ADMIN") fetchDocuments(1)
  }, [currentShop?.id, dateFilter, userRole]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this document?")) return
    const token = localStorage.getItem("accessToken")
    const res   = await fetch(`/api/sale-documents?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    const data  = await res.json()
    if (data.success) {
      toast.success("Deleted")
      setDocuments(prev => prev.filter(d => d.id.toString() !== id.toString()))
    } else toast.error(data.message || "Delete failed")
  }, [])

  // ── Access guard ─────────────────────────────────────────────────────────
  if (userRole !== "SUPER_DUPER_ADMIN" && userRole !== "SUPER_ADMIN") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">

        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600 text-center flex items-center justify-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Access Denied
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  const ArchiveSection = (
    <Card className="shadow-md border-0 bg-white h-full">
      <CardHeader className="bg-gray-50 border-b p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <CardTitle className="text-base">{t("Document Archive", "दस्तावेज़ संग्रह")}</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              type="date" value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="max-w-[150px] text-sm"
            />
            {dateFilter && (
              <Button variant="ghost" size="icon" onClick={() => setDateFilter("")} title="Clear"><X className="h-4 w-4" /></Button>
            )}
            <Button variant="outline" size="icon" onClick={() => fetchDocuments(1)} title="Refresh" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {loading && page === 1 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 mb-4" />
            <p className="text-sm">Loading…</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileImage className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">{t("No documents found", "कोई दस्तावेज़ नहीं मिला")}</p>
            <p className="text-xs mt-1">Upload your first document.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {documents.map(doc => (
                <DocCard key={doc.id} doc={doc} onDelete={handleDelete} formatFileSize={formatFileSize} />
              ))}
            </div>
            {page < totalPages && (
              <div className="text-center pt-4">
                <Button variant="outline" onClick={() => fetchDocuments(page + 1)} disabled={loading}>
                  {loading ? "Loading…" : "Load More"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 pb-20 md:pb-8">


      <div className="p-4 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileImage className="h-6 w-6 text-indigo-600" />
            {t("Sale Documents", "बिक्री दस्तावेज़")}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {t("Upload and manage daily sale bills & invoices", "दैनिक बिक्री बिल और चालान अपलोड करें")}
          </p>
        </div>

        {/* Desktop: side-by-side */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <DocumentUploadForm idPrefix="desktop" onUploadSuccess={() => fetchDocuments(1)} formatFileSize={formatFileSize} />
          </div>
          <div className="lg:col-span-2">{ArchiveSection}</div>
        </div>

        {/* Mobile: tabs */}
        <div className="block lg:hidden">
          <Tabs defaultValue="archive" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-indigo-100 p-1 h-auto rounded-xl">
              <TabsTrigger value="archive" className="py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">
                {t("Archive", "संग्रह")}
              </TabsTrigger>
              <TabsTrigger value="upload" className="py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm flex items-center justify-center gap-2">
                <UploadCloud className="h-4 w-4" />
                {t("Upload", "अपलोड")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="archive" className="mt-0">{ArchiveSection}</TabsContent>
            <TabsContent value="upload"  className="mt-0">
              <DocumentUploadForm idPrefix="mobile" onUploadSuccess={() => fetchDocuments(1)} formatFileSize={formatFileSize} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

// ─── Upload Form Component ───────────────────────────────────────────────────
function DocumentUploadForm({ idPrefix, onUploadSuccess, formatFileSize }: { idPrefix: string, onUploadSuccess: () => void, formatFileSize: (n: number) => string }) {
  const { t } = useLanguage()
  const { currentShop } = useShop()

  const [selectedFile,  setSelectedFile]  = useState<File | null>(null)
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null)
  const [documentDate,  setDocumentDate]  = useState(new Date().toISOString().slice(0, 10))
  const [description,   setDescription]  = useState("")
  const [uploading,     setUploading]     = useState(false)
  const [enhancing,     setEnhancing]     = useState(false)
  const [fileInputKey,  setFileInputKey]  = useState(Date.now())

  // cleanup preview URL on unmount
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0]
    if (!raw) return

    const validated = await processFile(raw)
    if (!validated) {
      setFileInputKey(Date.now())
      return
    }

    const originalSize = validated.size
    const wasOversized = originalSize > MAX_SIZE

    setEnhancing(true)
    toast.info(
      wasOversized
        ? `📦 Image is ${formatFileSize(originalSize)} — auto-compressing to ≤2 MB…`
        : "✨ Enhancing image…",
      { duration: 2000 }
    )

    try {
      const enhanced = await enhanceAndCompress(validated)
      // show preview
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(enhanced))
      setSelectedFile(enhanced)

      if (wasOversized) {
        toast.success(
          `✅ Compressed ${formatFileSize(originalSize)} → ${formatFileSize(enhanced.size)}`
        )
      } else {
        toast.success(`✅ Image enhanced & ready (${formatFileSize(enhanced.size)})`)
      }
    } catch {
      toast.error("Could not process image. Try another file.")
      setFileInputKey(Date.now())
    } finally { setEnhancing(false) }
  }, [previewUrl, formatFileSize])

  const handleUpload = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentShop?.id) { toast.error("Select a shop first"); return }
    if (!selectedFile)    { toast.error("Select a file to upload"); return }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("shopId", currentShop.id.toString())
      formData.append("documentDate", documentDate)
      if (description) formData.append("description", description)

      const token = localStorage.getItem("accessToken")
      const res   = await fetch("/api/sale-documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data  = await res.json()
      if (data.success) {
        toast.success("Document uploaded!")
        setSelectedFile(null)
        setDescription("")
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        setFileInputKey(Date.now())
        onUploadSuccess()
      } else toast.error(data.message || "Upload failed")
    } catch { toast.error("Upload error") }
    finally   { setUploading(false) }
  }, [currentShop?.id, selectedFile, documentDate, description, previewUrl, onUploadSuccess])

  const clearFile = useCallback(() => {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setFileInputKey(Date.now())
  }, [previewUrl])

  return (
    <Card className="shadow-md border-0 bg-white h-full">
      <CardHeader className="bg-indigo-600 text-white rounded-t-xl py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <UploadCloud className="h-5 w-5" />
          {t("Upload Document", "दस्तावेज़ अपलोड करें")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <Label className="text-xs text-gray-600 font-semibold uppercase tracking-wide">
              {t("Document Date", "दस्तावेज़ की तारीख")} *
            </Label>
            <Input type="date" value={documentDate} onChange={e => setDocumentDate(e.target.value)} required className="mt-1" />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex gap-2 text-xs text-amber-800">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Only real image files (JPG, PNG, WEBP, GIF) are accepted. Max&nbsp;<strong>2&nbsp;MB</strong>.</span>
          </div>

          <div>
            <Label className="text-xs text-gray-600 font-semibold uppercase tracking-wide">
              {t("Select Image", "चित्र चुनें")} *
            </Label>
            <div
              className={`mt-1 border-2 border-dashed rounded-xl transition-colors ${
                selectedFile
                  ? "border-indigo-400 bg-indigo-50"
                  : enhancing
                  ? "border-yellow-400 bg-yellow-50 animate-pulse"
                  : "border-gray-300 hover:border-indigo-400"
              }`}
            >
              <input
                key={fileInputKey}
                type="file"
                onChange={handleFileChange}
                className="hidden" id={`${idPrefix}-file-upload`}
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                disabled={enhancing || uploading}
              />
              <label htmlFor={`${idPrefix}-file-upload`} className="cursor-pointer flex flex-col items-center gap-2 p-4">
                {enhancing ? (
                  <>
                    <Sparkles className="h-8 w-8 text-yellow-500 animate-bounce" />
                    <span className="text-sm font-medium text-yellow-700">Enhancing image…</span>
                  </>
                ) : previewUrl ? (
                  <>
                    <img src={previewUrl} alt="preview" className="h-32 w-full object-cover rounded-lg border" />
                    <span className="text-xs font-medium text-indigo-700 break-all">{selectedFile?.name}</span>
                    <span className="text-xs text-indigo-500 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Enhanced · {selectedFile ? formatFileSize(selectedFile.size) : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-8 w-8 text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">Tap to pick an image</span>
                    <span className="text-xs text-gray-400">JPG · PNG · WEBP · GIF — max 2 MB</span>
                  </>
                )}
              </label>
            </div>
            {selectedFile && (
              <Button type="button" variant="ghost" size="sm" className="w-full mt-1 text-red-500 hover:text-red-700 text-xs" onClick={clearFile}>
                <X className="h-3 w-3 mr-1" /> Remove
              </Button>
            )}
          </div>

          <div>
            <Label className="text-xs text-gray-600 font-semibold uppercase tracking-wide">
              {t("Description (Optional)", "विवरण (वैकल्पिक)")}
            </Label>
            <Textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Bill no., customer name, notes…"
              className="mt-1 resize-none text-sm" rows={2}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={uploading || !selectedFile || enhancing}
          >
            {uploading ? (
              <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" /> Uploading…</>
            ) : (
              <><UploadCloud className="h-4 w-4 mr-2" /> Upload Document</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
