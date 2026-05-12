'use client'

import React, { useState, useEffect } from 'react'
import { X, Loader2, Shield, Pencil, Trash2 } from 'lucide-react'

export interface AdminEditField {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'textarea'
  value: any
  options?: { value: string; label: string }[]
  min?: number
  step?: number
  readOnly?: boolean
}

interface AdminEditModalProps {
  title: string
  fields: AdminEditField[]
  onSave: (changes: Record<string, any>, reason: string) => Promise<void>
  onClose: () => void
  open: boolean
}

export default function AdminEditModal({ title, fields, onSave, onClose, open }: AdminEditModalProps) {
  const [values, setValues] = useState<Record<string, any>>({})
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      const init: Record<string, any> = {}
      fields.forEach(f => { init[f.key] = f.value })
      setValues(init)
      setReason('')
      setError('')
    }
  }, [open, fields])

  if (!open) return null

  const handleSave = async () => {
    if (!reason.trim()) { setError('Reason for change is required'); return }
    setLoading(true)
    setError('')
    try {
      await onSave(values, reason.trim())
      onClose()
    } catch (e: any) {
      setError(e.message || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
        style={{ maxHeight: 'min(92vh, 700px)' }}
      >
        {/* ── Sticky Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <h2 className="font-bold text-gray-800 text-base leading-tight">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0 ml-2">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Admin warning badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700">
            <Shield className="h-3 w-3 flex-shrink-0" />
            <span>SUPER_DUPER_ADMIN — Change is permanent and logged</span>
          </div>

          {/* Fields */}
          {fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  value={values[field.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  disabled={field.readOnly}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 disabled:bg-gray-100 bg-white"
                >
                  {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  value={values[field.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  disabled={field.readOnly}
                  rows={2}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 disabled:bg-gray-100 resize-none"
                />
              ) : (
                <input
                  type={field.type}
                  value={values[field.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  disabled={field.readOnly}
                  min={field.min}
                  step={field.step}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 disabled:bg-gray-100"
                />
              )}
            </div>
          ))}

          {/* Reason */}
          <div>
            <label className="block text-sm font-semibold text-red-600 mb-1">
              Reason for change <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this record is being changed..."
              className="w-full border-2 border-red-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <span>⚠️</span> {error}
            </div>
          )}
        </div>

        {/* ── Sticky Footer — always visible ── */}
        <div className="flex-shrink-0 px-5 py-4 border-t rounded-b-2xl" style={{ background: '#f9fafb' }}>
          {/* Save Changes — full width, always on top */}
          <button
            onClick={handleSave}
            disabled={loading || !reason.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%',
              padding: '12px 16px',
              marginBottom: '8px',
              background: (loading || !reason.trim()) ? '#d97706' : '#d97706',
              opacity: (loading || !reason.trim()) ? 0.45 : 1,
              color: '#ffffff',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '700',
              border: 'none',
              cursor: (loading || !reason.trim()) ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
            }}
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <>✓ Save Changes</>
            }
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              background: 'transparent',
              color: '#4b5563',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}
