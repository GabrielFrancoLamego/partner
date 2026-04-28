'use client'

import { useState } from 'react'
import { DesktopSidebar } from './desktop-sidebar'
import { MobileBottomNav } from './mobile-bottom-nav'
import { ProfileHeader } from './profile-header'
import { RightSidebar } from './right-sidebar'
import { FeedContent } from './feed-content'

export function ModernLayout() {
  const [activeTab, setActiveTab] = useState('home')

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - Hidden on mobile/tablet */}
      <DesktopSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <div className="lg:ml-[260px] lg:mr-[340px] pb-20 lg:pb-0">
        <div className="max-w-[600px] lg:max-w-none mx-auto">
          <ProfileHeader />
          <FeedContent />
        </div>
      </div>

      {/* Right Sidebar - Desktop only */}
      <RightSidebar />

      {/* Mobile Bottom Navigation - Hidden on desktop */}
      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
