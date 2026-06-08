'use client'

import KaomojiPicker from '@web/components/EmojiPicker/emoji-picker'
import { Button } from '@web/components/ui/button'
import { Input } from '@web/components/ui/input'
import { Label } from '@web/components/ui/label'
import { Textarea } from '@web/components/ui/textarea'
import { Smile } from 'lucide-react'
import { useState } from 'react'

export const title = 'Emoji Picker in Form'

const KaomojiPickerExample = () => {
  const [message, setMessage] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState<string>('')

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji)
    setMessage((prev) => prev + emoji)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted:', { message, selectedEmoji })
    alert(`Message: ${message}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <div className="flex items-start gap-2">
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="min-h-25"
          />
          <KaomojiPicker
            onKaomojiSelect={handleEmojiSelect}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
              >
                <Smile className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <div className="flex items-center gap-2">
          <Input id="title" placeholder="Enter title..." className="flex-1" />
          <KaomojiPicker
            onKaomojiSelect={(emoji) => {
              const input = document.getElementById('title') as HTMLInputElement
              if (input) {
                input.value = input.value + emoji
              }
            }}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10"
              >
                <Smile className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>

      <Button type="submit">Submit</Button>
    </form>
  )
}

export default KaomojiPickerExample
