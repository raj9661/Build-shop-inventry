"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { useLanguage } from "@/hooks/use-language"
import { toast } from "sonner"
import { Plus, Trash2, Calculator } from "lucide-react"

interface TmtBarEntry {
  id: string
  companyName: string
  sizeMM: number
  bundleSize: number
  weightPerPiece: number
  bundleWeight: number
  arrivalTons: number
  totalBundles: number
  totalPieces: number
  sellByWeight: boolean
  sellByBundle: boolean
  sellByPiece: boolean
}

interface TmtBarFormProps {
  shopId: number
  onSave: (entries: TmtBarEntry[]) => Promise<void>
  isSubmitting: boolean
}

const COMMON_COMPANIES = [
  'TATA Tiscon', 'Rungta Steel', 'JSW Steel', 'SAIL', 'Vizag Steel',
  'Jindal Steel', 'Essar Steel', 'Bhushan Steel', 'Uttam Galva',
  'Kamdhenu Steel', 'Captain Steel', 'Shyam Steel'
]

const COMMON_SIZES = [6, 8, 10, 12, 16, 20, 25, 32]

export default function TmtBarForm({ shopId, onSave, isSubmitting }: TmtBarFormProps) {
  const { t } = useLanguage()
  const [entries, setEntries] = useState<TmtBarEntry[]>([])
  const [mixedLoad, setMixedLoad] = useState(false)

  // Add new entry
  const addEntry = () => {
    const newEntry: TmtBarEntry = {
      id: Date.now().toString(),
      companyName: '',
      sizeMM: 0,
      bundleSize: 0,
      weightPerPiece: 0,
      bundleWeight: 0,
      arrivalTons: 0,
      totalBundles: 0,
      totalPieces: 0,
      sellByWeight: true,
      sellByBundle: false,
      sellByPiece: false
    }
    setEntries([...entries, newEntry])
  }

  // Remove entry
  const removeEntry = (id: string) => {
    setEntries(entries.filter(entry => entry.id !== id))
  }

  // Update entry
  const updateEntry = (id: string, field: keyof TmtBarEntry, value: any) => {
    setEntries(entries.map(entry => {
      if (entry.id === id) {
        const updated = { ...entry, [field]: value }
        
        // Auto-calculate derived values
        if (field === 'bundleSize' || field === 'weightPerPiece') {
          updated.bundleWeight = updated.bundleSize * updated.weightPerPiece
        }
        
        if (field === 'arrivalTons' || field === 'bundleWeight') {
          const totalKg = updated.arrivalTons * 1000
          updated.totalBundles = Math.floor(totalKg / updated.bundleWeight)
          updated.totalPieces = updated.totalBundles * updated.bundleSize
        }
        
        return updated
      }
      return entry
    }))
  }

  // Calculate totals
  const calculateTotals = () => {
    const totalTons = entries.reduce((sum, entry) => sum + entry.arrivalTons, 0)
    const totalBundles = entries.reduce((sum, entry) => sum + entry.totalBundles, 0)
    const totalPieces = entries.reduce((sum, entry) => sum + entry.totalPieces, 0)
    const totalKg = totalTons * 1000

    return { totalTons, totalBundles, totalPieces, totalKg }
  }

  // Handle save
  const handleSave = async () => {
    if (entries.length === 0) {
      toast.error('Please add at least one TMT bar entry')
      return
    }

    const hasIncompleteEntries = entries.some(entry => 
      !entry.companyName || !entry.sizeMM || !entry.bundleSize || !entry.weightPerPiece || !entry.arrivalTons
    )

    if (hasIncompleteEntries) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      await onSave(entries)
      setEntries([])
      setMixedLoad(false)
      toast.success('TMT bars added successfully!')
    } catch (error) {
      console.error('Error saving TMT bars:', error)
      toast.error('Failed to save TMT bars')
    }
  }

  const totals = calculateTotals()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-center text-gray-800">TMT Bar Stock Management</h2>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="mixedLoad"
            checked={mixedLoad}
            onCheckedChange={(checked) => setMixedLoad(checked as boolean)}
          />
          <Label htmlFor="mixedLoad">Mixed Load</Label>
        </div>
      </div>

      {/* Totals Summary */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600">Total Weight</div>
              <div className="text-lg font-bold text-blue-600">{totals.totalKg.toFixed(2)} kg</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Tons</div>
              <div className="text-lg font-bold text-blue-600">{totals.totalTons.toFixed(2)} tons</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Bundles</div>
              <div className="text-lg font-bold text-blue-600">{totals.totalBundles}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Pieces</div>
              <div className="text-lg font-bold text-blue-600">{totals.totalPieces}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TMT Bar Entries */}
      <div className="space-y-4">
        {entries.map((entry, index) => (
          <Card key={entry.id} className="border-2 border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  TMT Bar Entry #{index + 1}
                </h3>
                {entries.length > 1 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeEntry(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Company Name */}
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Select
                    value={entry.companyName}
                    onValueChange={(value) => updateEntry(entry.id, 'companyName', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select or type company" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_COMPANIES.map(company => (
                        <SelectItem key={company} value={company}>{company}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Or enter custom company name"
                    value={entry.companyName}
                    onChange={(e) => updateEntry(entry.id, 'companyName', e.target.value)}
                  />
                </div>

                {/* Size */}
                <div className="space-y-2">
                  <Label>Rod Size (mm) *</Label>
                  <Select
                    value={entry.sizeMM.toString()}
                    onValueChange={(value) => updateEntry(entry.id, 'sizeMM', parseFloat(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_SIZES.map(size => (
                        <SelectItem key={size} value={size.toString()}>{size}mm</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Bundle Size */}
                <div className="space-y-2">
                  <Label>Bundle Size (rods per bundle) *</Label>
                  <Input
                    type="number"
                    placeholder="Enter bundle size"
                    value={entry.bundleSize || ''}
                    onChange={(e) => updateEntry(entry.id, 'bundleSize', parseInt(e.target.value) || 0)}
                  />
                </div>

                {/* Weight per Piece */}
                <div className="space-y-2">
                  <Label>Weight per Piece (kg) *</Label>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="Enter weight per piece"
                    value={entry.weightPerPiece || ''}
                    onChange={(e) => updateEntry(entry.id, 'weightPerPiece', parseFloat(e.target.value) || 0)}
                  />
                </div>

                {/* Arrival Quantity */}
                <div className="space-y-2">
                  <Label>Arrival Quantity (tons) *</Label>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="Enter arrival tons"
                    value={entry.arrivalTons || ''}
                    onChange={(e) => updateEntry(entry.id, 'arrivalTons', parseFloat(e.target.value) || 0)}
                  />
                </div>

                {/* Calculated Values */}
                <div className="space-y-2">
                  <Label>Calculated Values</Label>
                  <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm">
                    <div>Bundle Weight: <span className="font-semibold">{entry.bundleWeight.toFixed(3)} kg</span></div>
                    <div>Total Bundles: <span className="font-semibold">{entry.totalBundles}</span></div>
                    <div>Total Pieces: <span className="font-semibold">{entry.totalPieces}</span></div>
                  </div>
                </div>
              </div>

              {/* Selling Options */}
              <div className="mt-4 space-y-3">
                <Label>Selling Options</Label>
                <div className="flex space-x-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`weight-${entry.id}`}
                      checked={entry.sellByWeight}
                      onCheckedChange={(checked) => updateEntry(entry.id, 'sellByWeight', checked)}
                    />
                    <Label htmlFor={`weight-${entry.id}`}>Sell by Weight</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`bundle-${entry.id}`}
                      checked={entry.sellByBundle}
                      onCheckedChange={(checked) => updateEntry(entry.id, 'sellByBundle', checked)}
                    />
                    <Label htmlFor={`bundle-${entry.id}`}>Sell by Bundle</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`piece-${entry.id}`}
                      checked={entry.sellByPiece}
                      onCheckedChange={(checked) => updateEntry(entry.id, 'sellByPiece', checked)}
                    />
                    <Label htmlFor={`piece-${entry.id}`}>Sell by Piece</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Entry Button */}
      <div className="flex justify-center">
        <Button
          type="button"
          onClick={addEntry}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add TMT Bar Entry</span>
        </Button>
      </div>

      {/* Save Button */}
      <div className="flex justify-center">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting || entries.length === 0}
          className="px-8 py-3 text-lg"
        >
          {isSubmitting ? (
            <>
              <Calculator className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save TMT Bar Stock'
          )}
        </Button>
      </div>
    </div>
  )
}
