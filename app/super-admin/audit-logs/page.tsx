'use client'

import { useState, useEffect, useCallback } from 'react'
import { MobileNav } from '@/components/mobile-nav'
import { useShop } from '../../contexts/ShopContext'
import { Shield, Filter, RefreshCw, Loader2, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { toast } from 'sonner'

interface AuditLog {
  id: number
  adminId: number
  action: string
  tableName: string
  recordId: number
  beforeData: string
  afterData: string | null
  reason: string | null
  shopId: number
  createdAt: string
}

const tableLabels: Record<string, string> = {
  CustomerLedgerEntry: '👤 Customer Ledger',
  StockEntry: '📦 Stock Entry',
  SupplierPayment: '🏭 Supplier Payment',
}

const actionColors: Record<string, string> = {
  EDIT: 'bg-amber-100 text-amber-800 border border-amber-300',
  DELETE: 'bg-red-100 text-red-800 border border-red-300',
}

export default function AuditLogsPage() {
  const { currentShop, userRole } = useShop()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [expandedLog, setExpandedLog] = useState<number | null>(null)

  const fetchLogs = useCallback(async () => {
    if (!currentShop) return
    setLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({
        shopId: currentShop.id.toString(),
        page: page.toString(),
        limit: '30',
        ...(fromDate && { fromDate }),
        ...(toDate && { toDate }),
        ...(tableFilter && { tableName: tableFilter }),
      })
      const res = await fetch(`/api/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setLogs(data.data.logs)
        setTotalPages(data.data.pages)
        setTotal(data.data.total)
      } else {
        toast.error(data.message || 'Failed to fetch audit logs')
      }
    } catch {
      toast.error('Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }, [currentShop, page, fromDate, toDate, tableFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  if (userRole !== 'SUPER_DUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center text-white">
          <Shield className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-slate-400 mt-2">This page is restricted to SUPER_DUPER_ADMIN only.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">

      <div className="max-w-7xl mx-auto px-4 py-6 pb-20 md:pb-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl">
              <Shield className="h-8 w-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Audit Logs</h1>
              <p className="text-slate-400 text-sm">All record edits and deletions by SUPER_DUPER_ADMIN</p>
            </div>
          </div>
          <button
            onClick={fetchLogs}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => { setFromDate(e.target.value); setPage(1) }}
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => { setToDate(e.target.value); setPage(1) }}
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Table</label>
              <select
                value={tableFilter}
                onChange={e => { setTableFilter(e.target.value); setPage(1) }}
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
              >
                <option value="">All Tables</option>
                <option value="CustomerLedgerEntry">Customer Ledger</option>
                <option value="StockEntry">Stock Entry</option>
                <option value="SupplierPayment">Supplier Payment</option>
              </select>
            </div>
            {(fromDate || toDate || tableFilter) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); setTableFilter(''); setPage(1) }}
                className="px-3 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg text-sm hover:bg-red-600/30"
              >
                Clear Filters
              </button>
            )}
            <div className="ml-auto text-slate-400 text-sm self-end">
              {total} total records
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No audit logs found</p>
              <p className="text-sm mt-1">Admin actions will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">When</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Table</th>
                    <th className="px-4 py-3 text-left">Record ID</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                    <th className="px-4 py-3 text-center">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {logs.map(log => (
                    <>
                      <tr
                        key={log.id}
                        className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                          <div className="font-medium">{new Date(log.createdAt).toLocaleDateString('en-IN')}</div>
                          <div className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${actionColors[log.action] || 'bg-slate-700 text-slate-300'}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {tableLabels[log.tableName] || log.tableName}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          #{log.recordId}
                        </td>
                        <td className="px-4 py-3 text-slate-300 max-w-xs">
                          <span className="truncate block" title={log.reason || ''}>
                            {log.reason || <span className="text-slate-600 italic">No reason</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="p-1 rounded text-slate-400 hover:text-amber-400">
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      {expandedLog === log.id && (
                        <tr key={`${log.id}-detail`}>
                          <td colSpan={6} className="px-4 pb-4 bg-slate-900/30">
                            <div className="grid md:grid-cols-2 gap-4 pt-2">
                              <div>
                                <p className="text-xs font-semibold text-slate-400 mb-1 uppercase">Before</p>
                                <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap max-h-48">
                                  {JSON.stringify(JSON.parse(log.beforeData), null, 2)}
                                </pre>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-400 mb-1 uppercase">After {log.action === 'DELETE' ? '(Deleted)' : ''}</p>
                                <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-amber-400 overflow-x-auto whitespace-pre-wrap max-h-48">
                                  {log.afterData ? JSON.stringify(JSON.parse(log.afterData), null, 2) : '— DELETED —'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-xl text-white transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-slate-300 text-sm font-medium">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-xl text-white transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
