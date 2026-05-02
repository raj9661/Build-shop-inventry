'use client'

import React, { useState } from 'react'
import { AlertTriangle, Loader2, Shield } from 'lucide-react'

interface AdminDeleteConfirmProps {
  title: string
  description: string    // E.g. "Sale entry of ₹5,000 on 2026-05-01"
  open: boolean
  onConfirm: (reason: string) => Promise<void>
  onClose: () => void
}

export default function AdminDeleteConfirm({ title, description, open, onConfirm, onClose }: AdminDeleteConfirmProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const handleConfirm = async () => {
    if (!reason.trim()) { setError('Reason is required'); return }
    setLoading(true)
    setError('')
    try {
      await onConfirm(reason.trim())
      onClose()
    } catch (e: any) {
      setError(e.message || 'Delete failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-red-50 to-red-100 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-200 rounded-full">
              <AlertTriangle className="h-5 w-5 text-red-700" />
            </div>
            <div>
              <h2 className="font-bold text-red-800 text-lg">{title}</h2>
              <p className="text-sm text-red-600 mt-0.5">This action is logged and cannot be easily undone</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Record info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Record to delete</p>
            <p className="text-sm text-gray-800 font-medium">{description}</p>
          </div>

          {/* Admin badge */}
          <div className="px-3 py-2 bg-amber-100 border border-amber-300 rounded-lg text-xs font-semibold text-amber-800 flex items-center gap-1">
            <Shield className="h-3 w-3" />
            SUPER_DUPER_ADMIN — This deletion will be stored in audit logs
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for deletion <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); setError('') }}
              rows={3}
              placeholder="Why is this record being deleted? (e.g. 'Duplicate entry', 'Wrong amount entered')"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            {loading ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
