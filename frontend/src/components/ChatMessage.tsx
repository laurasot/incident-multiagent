import { memo, useState } from 'react'
import { Bot, User, ChevronDown, ChevronRight, Info, Check, Loader2 } from 'lucide-react'
import { cn, makeUrlsClickable, formatElapsedTime } from '../utils'
import type { Message } from '../types'
import { ToolUseBlockComponent } from './ToolUseBlock'
import { MarkdownRenderer } from './MarkdownRenderer'
import strandsIcon from '../icons/strands.png'
import openaiSdkIcon from '../icons/openaisdk.png'

const agentIcons: Record<string, string> = {
  'monitoringAgent': strandsIcon,
  'webSearchAgent': openaiSdkIcon,
}

const agentDisplayName: Record<string, string> = {
  'monitoringAgent': '🔍 Monitoring Agent',
  'webSearchAgent': '🌐 Web Search Agent',
}

interface ChatMessageProps {
  message: Message
  isStreaming?: boolean
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming = false,
}: ChatMessageProps) {
  const isUser = message.role === 'user'
  const contentWithLinks = makeUrlsClickable(message.content)
  const [showMetadata, setShowMetadata] = useState(false)

  return (
    <div
      className={cn(
        "flex w-full animate-fade-in-up",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex gap-3 max-w-[85%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-[#1c1f2e] text-[#e2e5f0] border border-white/[0.07]"
            : cn(
                "bg-[#151820] text-[#e2e5f0] border",
                isStreaming
                  ? "border-[#6b7af8]/40 shadow-[0_0_14px_rgba(107,122,248,0.12)] animate-pulse-border"
                  : "border-white/[0.06]"
              )
        )}
      >
        <div className="flex-shrink-0 mt-1">
          {isUser ? (
            <User className="w-4 h-4 text-[#4d5570]" />
          ) : (
            <Bot className="w-4 h-4 text-[#6b7af8]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* contentBlocks (ordered display) */}
          {!isUser && message.contentBlocks && message.contentBlocks.length > 0 && (
            <div>
              {message.contentBlocks.map((block, index) => {
                if (block.type === 'text') {
                  const isLastBlock = index === message.contentBlocks!.length - 1;
                  return (
                    <div
                      key={`text-${index}`}
                      className={cn(
                        "break-words text-sm leading-relaxed",
                        index > 0 && "mt-3"
                      )}
                    >
                      <MarkdownRenderer content={block.content} />
                      {isStreaming && isLastBlock && (
                        <span className="inline-block ml-1 text-[#6b7af8] animate-cursor-blink">▋</span>
                      )}
                    </div>
                  );
                } else if (block.type === 'tool') {
                  return null;
                } else if (block.type === 'transfer' && 'agentName' in block) {
                  const agentIcon = agentIcons[block.agentName];
                  const displayName = agentDisplayName[block.agentName] || block.agentName;
                  return (
                    <div
                      key={`transfer-${index}`}
                      className="my-3 rounded-xl border border-white/[0.07] bg-[#1c1f2e] overflow-hidden animate-slide-in"
                    >
                      {/* Transfer Header */}
                      <div className="px-3 py-2 border-b border-white/[0.05] flex items-center gap-2">
                        {isStreaming ? (
                          <>
                            <span className="w-1.5 h-1.5 bg-[#6b7af8] rounded-full animate-pulse" />
                            <span className="text-xs font-medium text-[#7d87a0]">Transferring to agent...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#56cfb2]" />
                            <span className="text-xs font-medium text-[#56cfb2]">Transferred to agent</span>
                          </>
                        )}
                      </div>
                      {/* Agent Name with Icon */}
                      <div className="px-3 py-2 flex items-center gap-2">
                        {agentIcon && (
                          <img src={agentIcon} alt={block.agentName} className="w-4 h-4 object-contain opacity-80" />
                        )}
                        <span className="text-sm font-medium text-[#c0c8db]">{displayName}</span>
                        {isStreaming && (
                          <Loader2 className="w-3.5 h-3.5 text-[#6b7af8] animate-spin ml-auto" />
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Fallback for user messages or old format */}
          {(isUser || (!message.contentBlocks || message.contentBlocks.length === 0)) && (
            <>
              {isUser ? (
                <div
                  className={cn(
                    "whitespace-pre-wrap break-words text-sm leading-relaxed",
                    isStreaming && "relative"
                  )}
                  dangerouslySetInnerHTML={{ __html: contentWithLinks }}
                />
              ) : (
                <div className={cn("break-words text-sm leading-relaxed", isStreaming && "relative")}>
                  <MarkdownRenderer content={message.content} />
                </div>
              )}

              {isStreaming && (
                <span className="inline-block ml-1 text-[#6b7af8] animate-cursor-blink">▋</span>
              )}
            </>
          )}

          {/* Metadata section */}
          {!isUser && message.metadata && !isStreaming && (
            <div className="mt-3">
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className="flex items-center gap-1.5 text-xs text-[#3d4560] hover:text-[#7d87a0] transition-colors duration-150"
              >
                {showMetadata ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <Info className="w-3 h-3" />
                <span>Metadata</span>
              </button>

              {showMetadata && (
                <div className="mt-2 p-3 bg-[#0f1119] rounded-lg border border-white/[0.05] text-xs animate-fade-in-up">
                  {message.metadata.usage && (
                    <div className="mb-2">
                      <div className="font-medium text-[#4d5570] mb-1">Token Usage</div>
                      <div className="text-[#3d4560] space-y-0.5">
                        <div>Input: {message.metadata.usage.inputTokens}</div>
                        <div>Output: {message.metadata.usage.outputTokens}</div>
                        <div>Total: {message.metadata.usage.totalTokens}</div>
                      </div>
                    </div>
                  )}

                  {message.metadata.metrics && (
                    <div className="mb-2">
                      <div className="font-medium text-[#4d5570] mb-1">Performance</div>
                      <div className="text-[#3d4560]">
                        {message.metadata.metrics.totalLatencyMs !== undefined && (
                          <div>Total Latency: {(message.metadata.metrics.totalLatencyMs / 1000).toFixed(2)}s</div>
                        )}
                      </div>
                    </div>
                  )}

                  {message.metadata.toolMetrics && Object.keys(message.metadata.toolMetrics).length > 0 && (
                    <div className="mb-2">
                      <div className="font-medium text-[#4d5570] mb-1">Tool Metrics</div>
                      {Object.entries(message.metadata.toolMetrics).map(([toolName, metrics]) => (
                        <div key={toolName} className="text-[#3d4560] mb-1">
                          <div className="font-medium text-[#4d5570]">{toolName}</div>
                          <div className="ml-2 space-y-0.5">
                            <div>Invocations: {metrics.invocations}</div>
                            <div>Avg Duration: {metrics.average_duration_seconds.toFixed(3)}s</div>
                            <div>Total Duration: {metrics.total_duration_seconds.toFixed(3)}s</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {message.metadata.cycleDurations && message.metadata.cycleDurations.length > 0 && (
                    <div>
                      <div className="font-medium text-[#4d5570] mb-1">Event Loop Cycles</div>
                      <div className="text-[#3d4560]">
                        Cycles: {message.metadata.cycleDurations.length}
                        <div className="ml-2">
                          {message.metadata.cycleDurations.map((duration, idx) => (
                            <div key={idx}>Cycle {idx + 1}: {duration.toFixed(3)}s</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {message.metadata.stopReason && (
                    <div className="mt-2 pt-2 border-t border-white/[0.05]">
                      <div className="font-medium text-[#4d5570]">Stop Reason</div>
                      <div className="text-[#3d4560]">{message.metadata.stopReason}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Elapsed time */}
          {!isUser && message.elapsed !== undefined && !isStreaming && !message.metadata && (
            <div className="mt-2 text-xs text-[#3d4560]">
              ⏱ Response time: {formatElapsedTime(message.elapsed)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
