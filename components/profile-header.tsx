'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import Image from 'next/image'

export function ProfileHeader() {
  return (
    <div className="relative">
      {/* Banner with gradient */}
      <div className="relative h-[200px] lg:h-[280px] w-full overflow-hidden rounded-b-3xl lg:rounded-none">
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-accent opacity-90" />
        <Image
          src="/images/banner-bg.jpg"
          alt="Banner background"
          fill
          className="object-cover mix-blend-overlay"
        />
      </div>

      {/* Profile content */}
      <div className="relative px-4 lg:px-6">
        {/* Profile Picture - overlapping banner */}
        <div className="relative -mt-16 lg:-mt-20 mb-4">
          <div className="relative w-24 h-24 lg:w-32 lg:h-32">
            <Image
              src="/images/profile-placeholder.jpg"
              alt="Profile"
              fill
              className="rounded-full border-4 border-background object-cover"
            />
          </div>
          
          {/* Follow button */}
          <Button
            className="absolute top-0 right-0 lg:right-auto lg:left-40 rounded-full px-6"
            size="lg"
          >
            Follow
          </Button>
        </div>

        {/* User info */}
        <div className="space-y-3 pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">UserName</h1>
            <CheckCircle2 className="h-5 w-5 text-primary fill-primary" />
          </div>
          <p className="text-muted-foreground">@UserName</p>
          <p className="text-foreground">Lorem ipsum dolor sit amet</p>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="font-bold text-foreground">500</span>{' '}
              <span className="text-muted-foreground">Following</span>
            </div>
            <div>
              <span className="font-bold text-foreground">10M</span>{' '}
              <span className="text-muted-foreground">Followers</span>
            </div>
          </div>
        </div>

        {/* HOME tab */}
        <div className="border-b border-border">
          <button className="relative px-4 py-4 font-bold text-foreground">
            HOME
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />
          </button>
        </div>
      </div>
    </div>
  )
}
