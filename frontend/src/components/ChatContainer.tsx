import { useEffect, useRef, useState } from 'react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { useChat } from '../hooks/useChat'
import { fetchAuthSession } from 'aws-amplify/auth'
import { Loader2 } from 'lucide-react'

interface ChatContainerProps {
  user: any
}

export function ChatContainer({ user }: ChatContainerProps) {
  const { messages, sendMessage, isStreaming, isInitialized, initializationError, initializeConversation, activeAgent } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)
  const [accessToken, setAccessToken] = useState<string>('')

  // Fetch access token
  useEffect(() => {
    const getToken = async () => {
      try {
        const session = await fetchAuthSession()
        const token = session.tokens?.accessToken?.toString() || ''
        setAccessToken(token)
      } catch (error) {
        console.error('Error fetching auth session:', error)
      }
    }
    getToken()
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize conversation on first load
  useEffect(() => {
    if (
      isInitialized &&
      !hasInitialized.current &&
      messages.length === 0 &&
      accessToken &&
      user
    ) {
      hasInitialized.current = true
      initializeConversation(
        accessToken,
        user.username
      )
    }
  }, [isInitialized, messages.length, accessToken, user, initializeConversation])

  const handleSendMessage = async (message: string) => {
    if (!accessToken || !user) return

    await sendMessage(
      message,
      accessToken,
      user.username
    )
  }

  if (initializationError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#f06a6a] mb-2 text-sm">❌ {initializationError}</p>
          <p className="text-[#4d5570] text-sm">Please check your CloudFormation stack configuration</p>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-6 h-6 text-[#6b7af8] animate-spin mx-auto mb-3" />
          <p className="text-[#4d5570] text-sm">Initializing agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Scrollable message history */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1
            const isStreamingMessage = isStreaming && isLastMessage && message.role === 'assistant'

            return (
              <ChatMessage
                key={`${message.timestamp}-${index}`}
                message={message}
                isStreaming={isStreamingMessage}
              />
            )
          })}

          {isStreaming && !activeAgent && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start animate-fade-in-up">
              <div className="bg-[#161923] border border-[#6b7af8]/25 rounded-2xl px-4 py-3 animate-thinking-pulse shadow-[0_0_12px_rgba(107,122,248,0.08)]">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6b7af8]" />
                  <span className="text-sm text-[#7d87a0]">Host Agent is thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed chat input at bottom */}
      <div className="flex-shrink-0">
        <ChatInput
          onSend={handleSendMessage}
          disabled={isStreaming}
        />
      </div>
    </div>
  )
}
