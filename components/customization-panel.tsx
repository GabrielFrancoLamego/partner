'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

export function CustomizationPanel() {
  const [sidebarBg, setSidebarBg] = useState('#FFFFFF')
  const [sidebarText, setSidebarText] = useState('#3E2415')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#3E2415] mb-2">Personalizar Interface</h2>
        <p className="text-gray-600">Configure as cores e aparência do seu painel</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Sidebar Customization */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-[#3E2415] mb-4">Menu Lateral</h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="sidebar-bg">Cor de Fundo</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="sidebar-bg"
                  type="color"
                  value={sidebarBg}
                  onChange={(e) => setSidebarBg(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={sidebarBg}
                  onChange={(e) => setSidebarBg(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sidebar-text">Cor do Texto</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="sidebar-text"
                  type="color"
                  value={sidebarText}
                  onChange={(e) => setSidebarText(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={sidebarText}
                  onChange={(e) => setSidebarText(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="pt-4">
              <p className="text-sm text-gray-600 mb-2">Presets de Cores:</p>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    setSidebarBg('#FFFFFF')
                    setSidebarText('#3E2415')
                  }}
                  className="w-full h-10 rounded-lg border-2 border-gray-200"
                  style={{ background: 'linear-gradient(135deg, #FFFFFF 50%, #3E2415 50%)' }}
                  title="Areia (Padrão)"
                />
                <button
                  onClick={() => {
                    setSidebarBg('#E8F4F8')
                    setSidebarText('#3E2415')
                  }}
                  className="w-full h-10 rounded-lg border-2 border-gray-200"
                  style={{ background: 'linear-gradient(135deg, #E8F4F8 50%, #3E2415 50%)' }}
                  title="Oceano"
                />
                <button
                  onClick={() => {
                    setSidebarBg('#FFF5E6')
                    setSidebarText('#F58220')
                  }}
                  className="w-full h-10 rounded-lg border-2 border-gray-200"
                  style={{ background: 'linear-gradient(135deg, #FFF5E6 50%, #F58220 50%)' }}
                  title="Pôr do Sol"
                />
                <button
                  onClick={() => {
                    setSidebarBg('#FFFFFF')
                    setSidebarText('#333333')
                  }}
                  className="w-full h-10 rounded-lg border-2 border-gray-200"
                  style={{ background: 'linear-gradient(135deg, #FFFFFF 50%, #333333 50%)' }}
                  title="Clássico"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Banner Customization */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-[#3E2415] mb-4">Banner e Perfil</h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="banner-upload">Imagem de Fundo</Label>
              <Input
                id="banner-upload"
                type="file"
                accept="image/*"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Recomendado: 1500x400px</p>
            </div>

            <div>
              <Label htmlFor="profile-upload">Foto de Perfil</Label>
              <Input
                id="profile-upload"
                type="file"
                accept="image/*"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Recomendado: 400x400px</p>
            </div>

            <div>
              <Label htmlFor="company-name">Nome da Empresa</Label>
              <Input
                id="company-name"
                type="text"
                placeholder="Nome da Empresa"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="company-handle">Handle</Label>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-500">@</span>
                <Input
                  id="company-handle"
                  type="text"
                  placeholder="empresa_handle"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" className="rounded-full">
          Resetar
        </Button>
        <Button className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-full px-8">
          Salvar Alterações
        </Button>
      </div>
    </div>
  )
}
