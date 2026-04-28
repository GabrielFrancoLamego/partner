'use client'

import { CheckCircle2, ImageIcon, MessageCircle, Repeat2, Heart, Share } from 'lucide-react'
import Image from 'next/image'

const posts = [
  {
    id: 1,
    author: 'John Smith',
    handle: '@johnsmith',
    time: '36m',
    content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis elit sapien, convallis vel enim sit amet, egestas commodo arcu Sed placerat congue convallis.',
    verified: true,
  },
  {
    id: 2,
    author: 'William Doe',
    handle: '@williamdoe',
    time: '30m',
    content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis elit sapien, convallis vel enim sit amet, egestas commodo arcu Sed placerat congue convallis.',
    verified: true,
    images: 2,
  },
]

export function FeedContent() {
  return (
    <div className="px-4 lg:px-6 pt-4 space-y-4">
      {/* What's happening input */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-muted-foreground mb-3">What's happening?</p>
        <div className="flex items-center gap-3">
          <button className="text-primary hover:bg-accent p-2 rounded-lg">
            <ImageIcon className="h-5 w-5" />
          </button>
          <button className="text-primary hover:bg-accent p-2 rounded-lg">
            <ImageIcon className="h-5 w-5" />
          </button>
          <button className="text-primary hover:bg-accent p-2 rounded-lg">
            <ImageIcon className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <button className="bg-primary text-primary-foreground px-6 py-2 rounded-full font-medium hover:opacity-90">
            Tweet
          </button>
        </div>
      </div>

      {/* Posts feed */}
      {posts.map((post) => (
        <div key={post.id} className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex gap-3">
            {/* Avatar */}
            <div className="relative w-12 h-12 flex-shrink-0">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-secondary" />
            </div>

            {/* Post content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-foreground">{post.author}</span>
                {post.verified && (
                  <CheckCircle2 className="h-4 w-4 text-primary fill-primary" />
                )}
                <span className="text-muted-foreground text-sm">{post.handle}</span>
                <span className="text-muted-foreground text-sm">· {post.time}</span>
              </div>

              <p className="text-foreground mb-3">{post.content}</p>

              {/* Images if present */}
              {post.images && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl" />
                  <div className="relative aspect-video bg-gradient-to-br from-secondary/20 to-accent/20 rounded-xl" />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-8 text-muted-foreground">
                <button className="flex items-center gap-2 hover:text-primary transition-colors">
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-sm">14</span>
                </button>
                <button className="flex items-center gap-2 hover:text-secondary transition-colors">
                  <Repeat2 className="h-4 w-4" />
                  <span className="text-sm">5</span>
                </button>
                <button className="flex items-center gap-2 hover:text-destructive transition-colors">
                  <Heart className="h-4 w-4" />
                </button>
                <button className="flex items-center gap-2 hover:text-primary transition-colors">
                  <Share className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
