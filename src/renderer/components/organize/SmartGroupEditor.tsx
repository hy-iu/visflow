import React, { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { useLibraryStore } from '../../stores/useLibraryStore'
import './SmartGroupEditor.css'

interface SmartGroupEditorProps {
  groupId: string | null
  isOpen: boolean
  onClose: () => void
}

interface Rule {
  field: 'rating' | 'colorLabel' | 'fileName' | 'fileType'
  operator: 'eq' | 'gte' | 'lte' | 'contains'
  value: any
}

export default function SmartGroupEditor({ groupId, isOpen, onClose }: SmartGroupEditorProps) {
  const [name, setName] = useState('')
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all')
  const [rules, setRules] = useState<Rule[]>([
    { field: 'rating', operator: 'gte', value: 4 },
  ])

  const loadSmartGroups = useLibraryStore((s) => s.loadSmartGroups)

  useEffect(() => {
    if (isOpen && groupId) {
      // Load details of editing group
      const fetchGroup = async () => {
        try {
          const list = await window.api.getSmartGroups()
          const current = list.find((g: any) => g.id === groupId)
          if (current) {
            setName(current.name || '')
            const parsedRules = current.rulesJson ? JSON.parse(current.rulesJson) : { match: 'all', rules: [] }
            setMatchMode(parsedRules.match || 'all')
            setRules(parsedRules.rules || [])
          }
        } catch (err) {
          console.error(err)
        }
      }
      fetchGroup()
    } else if (isOpen && !groupId) {
      setName('')
      setMatchMode('all')
      setRules([{ field: 'rating', operator: 'gte', value: 4 }])
    }
  }, [groupId, isOpen])

  const handleAddRule = () => {
    setRules((prev) => [...prev, { field: 'rating', operator: 'gte', value: 4 }])
  }

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRuleChange = (index: number, key: keyof Rule, val: any) => {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        const updated = { ...r, [key]: val } as Rule
        // Auto correct operator when field changes
        if (key === 'field') {
          if (val === 'rating') {
            updated.operator = 'gte'
            updated.value = 4
          } else if (val === 'colorLabel') {
            updated.operator = 'eq'
            updated.value = 'red'
          } else if (val === 'fileName' || val === 'fileType') {
            updated.operator = 'contains'
            updated.value = ''
          }
        }
        return updated
      })
    )
  }

  const handleSave = async () => {
    if (!name.trim()) return
    const payload = {
      name,
      rules: {
        match: matchMode,
        rules,
      },
    }

    try {
      if (groupId) {
        await window.api.updateSmartGroup(groupId, payload)
      } else {
        await window.api.createSmartGroup(payload)
      }
      loadSmartGroups()
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={groupId ? '编辑智能分组' : '新建智能分组'}
      footer={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim() || rules.length === 0}>
            保存
          </button>
        </div>
      }
    >
      <div className="smart-group-editor">
        <input
          type="text"
          className="input smart-group-editor__name-input"
          placeholder="分组名称 (例如: 评分大于4星)..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="smart-group-editor__match-row">
          <span>匹配方式:</span>
          <div className="smart-group-editor__match-toggle">
            <div
              className={`smart-group-editor__match-option ${matchMode === 'all' ? 'smart-group-editor__match-option--active' : ''}`}
              onClick={() => setMatchMode('all')}
            >
              符合全部条件 (AND)
            </div>
            <div
              className={`smart-group-editor__match-option ${matchMode === 'any' ? 'smart-group-editor__match-option--active' : ''}`}
              onClick={() => setMatchMode('any')}
            >
              符合任一条件 (OR)
            </div>
          </div>
        </div>

        <div className="smart-group-editor__rules">
          {rules.map((rule, index) => (
            <div key={index} className="smart-group-editor__rule">
              {/* Field Select */}
              <select
                className="select smart-group-editor__rule-select"
                value={rule.field}
                onChange={(e) => handleRuleChange(index, 'field', e.target.value)}
              >
                <option value="rating">图片评分</option>
                <option value="colorLabel">颜色标签</option>
                <option value="fileName">文件名</option>
                <option value="fileType">文件格式</option>
              </select>

              {/* Operator */}
              {rule.field === 'rating' ? (
                <select
                  className="select"
                  value={rule.operator}
                  onChange={(e) => handleRuleChange(index, 'operator', e.target.value)}
                >
                  <option value="eq">等于</option>
                  <option value="gte">大于等于</option>
                  <option value="lte">小于等于</option>
                </select>
              ) : rule.field === 'colorLabel' ? (
                <select
                  className="select"
                  value={rule.operator}
                  onChange={(e) => handleRuleChange(index, 'operator', e.target.value)}
                >
                  <option value="eq">等于</option>
                </select>
              ) : (
                <select
                  className="select"
                  value={rule.operator}
                  onChange={(e) => handleRuleChange(index, 'operator', e.target.value)}
                >
                  <option value="contains">包含</option>
                </select>
              )}

              {/* Value Input */}
              {rule.field === 'rating' ? (
                <select
                  className="select"
                  value={rule.value}
                  onChange={(e) => handleRuleChange(index, 'value', parseInt(e.target.value))}
                >
                  <option value="1">★☆☆☆☆</option>
                  <option value="2">★★☆☆☆</option>
                  <option value="3">★★★☆☆</option>
                  <option value="4">★★★★☆</option>
                  <option value="5">★★★★★</option>
                </select>
              ) : rule.field === 'colorLabel' ? (
                <select
                  className="select"
                  value={rule.value}
                  onChange={(e) => handleRuleChange(index, 'value', e.target.value)}
                >
                  <option value="red">红色</option>
                  <option value="yellow">黄色</option>
                  <option value="green">绿色</option>
                  <option value="blue">蓝色</option>
                  <option value="purple">紫色</option>
                </select>
              ) : (
                <input
                  type="text"
                  className="input smart-group-editor__rule-input"
                  placeholder={rule.field === 'fileType' ? '例如: png, jpeg' : '关键字...'}
                  value={rule.value}
                  onChange={(e) => handleRuleChange(index, 'value', e.target.value)}
                />
              )}

              <button className="smart-group-editor__rule-remove" onClick={() => handleRemoveRule(index)}>
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="smart-group-editor__add-rule" onClick={handleAddRule}>
          + 添加规则条件
        </div>
      </div>
    </Modal>
  )
}
