"use client"

import { useEffect, useRef } from "react"
import { Bold, Italic, List, ListOrdered, Heading2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Editor de texto rico leve — sem dependência externa (Tiptap/Quill), usando
 * contentEditable + document.execCommand (ainda suportado por todos os
 * navegadores evergreen para os comandos básicos usados aqui). Suficiente
 * para negrito/itálico/títulos/listas; grava e lê HTML puro.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exec = (command: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-gray-100 bg-gray-50 p-1.5">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("bold")} title="Negrito">
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("italic")} title="Itálico">
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("formatBlock", "h3")} title="Título">
          <Heading2 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("insertUnorderedList")} title="Lista">
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => exec("insertOrderedList")}
          title="Lista numerada"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        className="min-h-[120px] p-3 text-sm focus:outline-none [&_h3]:font-bold [&_h3]:text-base [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
      />
    </div>
  )
}
