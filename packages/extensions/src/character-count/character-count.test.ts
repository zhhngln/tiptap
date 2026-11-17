import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { TextSelection } from '@tiptap/pm/state'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { CharacterCount } from './character-count.js'

let editor: Editor

function createEditor(limit: number | null = 5, content = '<p>abc</p>') {
  editor = new Editor({
    extensions: [Document, Paragraph, Text, CharacterCount.configure({ limit })],
    content,
  })
  editor.commands.setTextSelection(4)
}

function startComposition() {
  editor.view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
}

function compose(limit: number | null = 5, content?: string) {
  createEditor(limit, content)
  startComposition()
  editor.view.dispatch(editor.state.tr.insertText('zhongwen'))
}

function endComposition() {
  editor.view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  editor.destroy()
  vi.useRealTimers()
})

describe('CharacterCount composition', () => {
  it('allows text over the limit while composing', () => {
    compose()
    expect(editor.view.composing).toBe(true)
    expect(editor.getText()).toBe('abczhongwen')
  })

  it('trims excess before the cursor after composition ends', async () => {
    compose(5, '<p>abcXY</p>')
    endComposition()
    expect(editor.getText()).toBe('abczhongwenXY')
    await vi.advanceTimersByTimeAsync(20)
    expect(editor.getText()).toBe('abcXY')
  })

  it('waits for the final deferred composition transaction', async () => {
    compose()
    editor.view.dom.addEventListener('compositionend', () => {
      setTimeout(() => {
        const tr = editor.state.tr.insertText('中文测试', 4, 12)
        editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, 8)))
      }, 20)
    })
    endComposition()
    await vi.advanceTimersByTimeAsync(20)
    expect(editor.getText()).toBe('abc中文')
  })

  it('cancels the pending trim when a new composition starts', async () => {
    compose()
    endComposition()
    await vi.advanceTimersByTimeAsync(10)
    startComposition()
    await vi.advanceTimersByTimeAsync(20)
    expect(editor.getText()).toBe('abczhongwen')
  })

  it('cancels the pending trim when the view is destroyed', async () => {
    compose()
    endComposition()
    await Promise.resolve()
    editor.destroy()
    await expect(vi.advanceTimersByTimeAsync(20)).resolves.not.toThrow()
  })

  it('keeps composed text without a limit', async () => {
    compose(null)
    endComposition()
    await vi.advanceTimersByTimeAsync(20)
    expect(editor.getText()).toBe('abczhongwen')
  })

  it('blocks normal typing over the limit', () => {
    createEditor()
    editor.view.dispatch(editor.state.tr.insertText('zhongwen'))
    expect(editor.getText()).toBe('abc')
  })
})
