"use client"

import { useEffect, useRef, useState } from "react"
import { Heart, MessageCircle, ImagePlus, Check, X, Loader2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge } from "@/components/admin/admin-ui"
import { useCompanyUser } from "@/lib/company-user-context"
import { canManageDailyOperations } from "@/lib/permissions"

type Post = {
  id: string
  title: string | null
  content: string
  imageUrl: string | null
  status: "PENDING_APPROVAL" | "PUBLISHED" | "REJECTED"
  rejectionReason: string | null
  createdAt: string
  author: { id: string; name: string; role: string }
  reviewedBy: { id: string; name: string } | null
  likedByMe: boolean
  _count: { likes: number; comments: number }
}

type Comment = { id: string; message: string; createdAt: string; author: { id: string; name: string } }

const formatDate = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

export default function CompanyMuralPage() {
  const user = useCompanyUser()
  const isManager = canManageDailyOperations(user.role)
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<"feed" | "pending">("feed")

  const reload = () => {
    setIsLoading(true)
    adminFetch<Post[]>(`/api/company/posts${tab === "pending" ? "?scope=pending" : ""}`)
      .then(setPosts)
      .finally(() => setIsLoading(false))
  }

  useEffect(reload, [tab])

  const handleLike = async (post: Post) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likedByMe: !p.likedByMe, _count: { ...p._count, likes: p._count.likes + (p.likedByMe ? -1 : 1) } }
          : p,
      ),
    )
    await adminFetch(`/api/company/posts/${post.id}/like`, { method: "POST" }).catch(() => reload())
  }

  const handleReview = async (post: Post, status: "PUBLISHED" | "REJECTED") => {
    await adminFetch(`/api/company/posts/${post.id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(
      (e) => alert(e instanceof AdminApiError ? e.message : "Erro"),
    )
    reload()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Mural de Novidades</h1>
        <p className="text-gray-600 mt-1 text-sm">Comunicados, avisos e novidades da equipe</p>
      </div>

      {isManager && (
        <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 w-fit">
          <Button
            size="sm"
            variant={tab === "feed" ? "default" : "ghost"}
            onClick={() => setTab("feed")}
            className={tab === "feed" ? "text-xs bg-[#3E2415] text-white" : "text-xs text-gray-600"}
          >
            Feed
          </Button>
          <Button
            size="sm"
            variant={tab === "pending" ? "default" : "ghost"}
            onClick={() => setTab("pending")}
            className={tab === "pending" ? "text-xs bg-[#3E2415] text-white" : "text-xs text-gray-600"}
          >
            Pendentes de aprovação
          </Button>
        </div>
      )}

      {tab === "feed" && <PostComposer onCreated={reload} />}

      {isLoading ? (
        <LoadingState />
      ) : posts.length === 0 ? (
        <EmptyState message={tab === "pending" ? "Nenhum post pendente." : "Nenhuma novidade publicada ainda."} />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} isManager={isManager} onLike={handleLike} onReview={handleReview} />
          ))}
        </div>
      )}
    </div>
  )
}

function PostComposer({ onCreated }: { onCreated: () => void }) {
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setIsSubmitting(true)
    setError("")
    try {
      const body = new FormData()
      if (title.trim()) body.append("title", title.trim())
      body.append("content", content.trim())
      if (file) body.append("file", file)
      await adminFetch("/api/company/posts", { method: "POST", body })
      setContent("")
      setTitle("")
      setFile(null)
      onCreated()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao publicar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 space-y-3">
      <Input placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea
        placeholder="Compartilhe uma novidade com a equipe..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus className="h-4 w-4 mr-1.5" />
          {file ? file.name.slice(0, 20) : "Adicionar imagem"}
        </Button>
        <Button
          size="sm"
          disabled={!content.trim() || isSubmitting}
          onClick={handleSubmit}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
        </Button>
      </div>
    </div>
  )
}

function PostCard({
  post,
  isManager,
  onLike,
  onReview,
}: {
  post: Post
  isManager: boolean
  onLike: (post: Post) => void
  onReview: (post: Post, status: "PUBLISHED" | "REJECTED") => void
}) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [newComment, setNewComment] = useState("")

  const loadComments = () => {
    setShowComments((prev) => !prev)
    if (!comments) {
      adminFetch<Comment[]>(`/api/company/posts/${post.id}/comments`).then(setComments)
    }
  }

  const handleComment = async () => {
    if (!newComment.trim()) return
    const created = await adminFetch<Comment>(`/api/company/posts/${post.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ message: newComment.trim() }),
    }).catch(() => null)
    if (created) {
      setComments((prev) => [...(prev ?? []), created])
      setNewComment("")
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
      {post.imageUrl && <img src={post.imageUrl} alt={post.title ?? ""} className="w-full max-h-72 object-cover" />}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#3E2415]">{post.author.name}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatDate(post.createdAt)}
            </p>
          </div>
          {post.status !== "PUBLISHED" && <StatusBadge status={post.status} />}
        </div>

        {post.title && <p className="font-bold text-[#3E2415]">{post.title}</p>}
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.content}</p>

        {post.status === "REJECTED" && post.rejectionReason && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
            Motivo da reprovação: {post.rejectionReason}
          </p>
        )}

        <div className="flex items-center gap-4 pt-2 border-t border-gray-50">
          <button
            onClick={() => onLike(post)}
            className={`flex items-center gap-1.5 text-sm ${post.likedByMe ? "text-red-500" : "text-gray-500"} hover:text-red-500 transition-colors`}
          >
            <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-red-500" : ""}`} />
            {post._count.likes}
          </button>
          <button onClick={loadComments} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#F58220] transition-colors">
            <MessageCircle className="h-4 w-4" />
            {post._count.comments}
          </button>

          {isManager && post.status === "PENDING_APPROVAL" && (
            <div className="flex items-center gap-1 ml-auto">
              <Button variant="ghost" size="icon" className="text-green-600" onClick={() => onReview(post, "PUBLISHED")}>
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-red-600" onClick={() => onReview(post, "REJECTED")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {showComments && (
          <div className="space-y-2 pt-2 border-t border-gray-50">
            {comments === null ? (
              <p className="text-xs text-gray-400">Carregando...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhum comentário ainda.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="text-sm bg-gray-50 rounded-lg p-2">
                  <span className="font-semibold text-[#3E2415]">{c.author.name}: </span>
                  <span className="text-gray-700">{c.message}</span>
                </div>
              ))
            )}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Escreva um comentário..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
              />
              <Button size="sm" onClick={handleComment} disabled={!newComment.trim()}>
                Enviar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
