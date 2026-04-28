'use client'

import { Search, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const trends = [
  { name: 'UserName', handle: '@UserName', tweets: '1000 Tweets' },
  { name: 'UserName', handle: '@UserName', tweets: '5000 Tweets' },
  { name: 'UserName', handle: '@UserName', tweets: '670 Tweets' },
  { name: 'UserName', handle: '@UserName', tweets: '500 Tweets' },
]

export function RightSidebar() {
  return (
    <aside className="hidden lg:flex fixed right-0 top-0 h-screen w-[340px] flex-col bg-background p-4 gap-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search"
          className="pl-10 bg-accent border-0 rounded-full h-12"
        />
      </div>

      {/* Auth buttons */}
      <div className="flex gap-2">
        <Button className="flex-1 rounded-full" size="lg">
          Log In
        </Button>
        <Button variant="outline" className="flex-1 rounded-full" size="lg">
          Sign Up
        </Button>
      </div>

      {/* Preview cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="aspect-square bg-gradient-to-br from-primary/30 to-secondary/30 rounded-2xl" />
        <div className="aspect-square bg-gradient-to-br from-secondary/30 to-accent/30 rounded-2xl" />
        <div className="aspect-square bg-gradient-to-br from-accent/30 to-primary/30 rounded-2xl" />
      </div>

      {/* Description text */}
      <p className="text-sm text-muted-foreground">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis elit sapien, convallis elit arcu Sed placerat congue convallis.
      </p>

      {/* Trends */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <h3 className="font-bold text-xl mb-4">Trends for you</h3>
        <div className="space-y-4">
          {trends.map((trend, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-foreground">{trend.name}</span>
                  <CheckCircle2 className="h-4 w-4 text-primary fill-primary" />
                </div>
                <p className="text-sm text-muted-foreground">{trend.handle}</p>
                <p className="text-sm text-primary">{trend.tweets}</p>
              </div>
              <Button className="rounded-full px-4" size="sm">
                Follow
              </Button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
