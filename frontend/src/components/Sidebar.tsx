import { useChat } from '../hooks/useChat'
import strandsIcon from '../icons/strands.png'
import openaiSdkIcon from '../icons/openaisdk.png'

interface SidebarProps {
  signOut: () => void
}

export function Sidebar({ signOut }: SidebarProps) {
  const { sessionId, agentCards, activeAgent } = useChat()

  const agentIcons: Record<string, string> = {
    'monitoringAgent': strandsIcon,
    'webSearchAgent': openaiSdkIcon,
  };

  const agentDisplayName: Record<string, string> = {
    'monitoringAgent': 'Monitoring Agent',
    'webSearchAgent': 'Web Search Agent',
  };

  return (
    <aside className="w-full h-full bg-[#0f1119] flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-white/[0.06] flex-shrink-0">
        <h2 className="text-sm font-semibold text-[#7d87a0] uppercase tracking-widest">Session Info</h2>
      </div>

      <div className="flex-1 p-4 space-y-5 overflow-y-auto min-h-0">
        {/* Session ID */}
        <div>
          <h3 className="text-xs font-medium text-[#4d5570] mb-2 uppercase tracking-wider">Session ID</h3>
          <div className="bg-[#161923] border border-white/[0.05] rounded-lg p-3 text-xs text-[#7d87a0] font-mono break-all leading-relaxed">
            {sessionId}
          </div>
        </div>

        {/* Agent Cards */}
        {agentCards && Object.keys(agentCards).length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-[#4d5570] mb-3 uppercase tracking-wider">Sub-Agents</h3>
            <div className="space-y-3">
              {Object.entries(agentCards).map(([agentName, agentInfo]) => {
                const isActive = activeAgent === agentName;
                return (
                  <div
                    key={agentName}
                    className={`rounded-xl p-3 transition-all duration-300 ${
                      isActive
                        ? 'bg-[#6b7af8]/10 border border-[#6b7af8]/40 shadow-[0_0_16px_rgba(107,122,248,0.12)]'
                        : 'bg-[#161923] border border-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {agentIcons[agentName] && (
                        <img src={agentIcons[agentName]} alt={agentName} className="w-5 h-5 object-contain opacity-90" />
                      )}
                      <div className="text-sm font-medium text-[#e2e5f0]">
                        {agentDisplayName[agentName] || agentName}
                      </div>
                      {isActive && (
                        <span className="ml-auto flex items-center gap-1.5 text-xs text-[#6b7af8]">
                          <span className="w-1.5 h-1.5 bg-[#6b7af8] rounded-full animate-pulse" />
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#4d5570] mb-2 leading-relaxed">
                      {agentInfo.agent_card.description || 'No description'}
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs">
                        <span className="text-[#3d4560]">Name:</span>
                        <span className="text-[#7d87a0] ml-1">{agentInfo.agent_card.name}</span>
                      </div>
                      {agentInfo.agent_card.version && (
                        <div className="text-xs">
                          <span className="text-[#3d4560]">Version:</span>
                          <span className="text-[#7d87a0] ml-1">{agentInfo.agent_card.version}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 p-4 border-t border-white/[0.06]">
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-3 py-2 bg-[#6b7af8]/15 hover:bg-[#6b7af8]/25 text-[#a5aeff] border border-[#6b7af8]/25 hover:border-[#6b7af8]/45 rounded-lg transition-all duration-200 text-sm font-medium"
          >
            New Session
          </button>
          <button
            onClick={signOut}
            className="flex-1 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.07] text-[#7d87a0] hover:text-[#c0c8db] border border-white/[0.06] hover:border-white/[0.1] rounded-lg transition-all duration-200 text-sm font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  )
}
