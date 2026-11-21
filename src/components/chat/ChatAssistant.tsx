import { useQueryClient } from "@tanstack/react-query";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useChatAssistant } from "@/hooks/useChatAssistant";
import { useWorkflowDataAppConfig } from "@/hooks/useDataAppSessions";

type ChatAssistantProps = {
  workflowId: string;
  /**
   * Display name shown in the chat header.
   * Falls back to the workflow's `card_title` config value, then "Assistant".
   */
  name?: string;
  /**
   * Label shown above each assistant message.
   * Falls back to `name`, then the workflow's `responder_name`, then the resolved chat title.
   */
  assistantName?: string;
  className?: string;
  /** When true, removes border/radius so the chat fills its container edge-to-edge. */
  fullPage?: boolean;
  /**
   * Message shown when the conversation is empty and the workflow is ready.
   * Falls back to the workflow's `welcome_message` config value, then a generic prompt.
   */
  emptyMessage?: string;
  notReadyMessage?: string;
};

/**
 * Platform-connected chat. Wires the workflow messaging + session hooks to the
 * presentational `ChatPanel` (shared base component). Resolves display strings
 * from explicit props → workflow config → static fallback.
 */
export function ChatAssistant({
  workflowId,
  name,
  assistantName,
  className,
  fullPage = false,
  emptyMessage,
  notReadyMessage = "Publish this workflow from the platform to enable chat.",
}: ChatAssistantProps) {
  const queryClient = useQueryClient();
  const {
    messages,
    sendMessage,
    isLoading,
    sessions,
    loadSession,
    startNewChat,
    ready,
  } = useChatAssistant(workflowId);

  const { data: config } = useWorkflowDataAppConfig(workflowId);

  const configProps =
    config?.data?.attributes.configuration.interface?.properties;

  // Explicit props take priority; workflow config values are the next fallback;
  // static strings are the last resort so the component always renders something.
  const resolvedChatTitle = name ?? configProps?.card_title ?? "Assistant";

  const resolvedAssistantName =
    assistantName ?? configProps?.chat_bot?.responder_name ?? resolvedChatTitle;

  const resolvedWelcomeMessage =
    emptyMessage ??
    configProps?.chat_bot?.welcome_message ??
    "Ask anything to get started.";

  return (
    <ChatPanel
      title={resolvedChatTitle}
      assistantName={resolvedAssistantName}
      welcomeMessage={resolvedWelcomeMessage}
      notReadyMessage={notReadyMessage}
      chatbotAvatar={configProps?.chat_bot?.avatar?.value}
      fullPage={fullPage}
      className={className}
      messages={messages}
      isLoading={isLoading}
      ready={ready}
      sessions={sessions}
      onSend={sendMessage}
      onLoadSession={loadSession}
      onNewChat={startNewChat}
      onHistoryOpen={() =>
        queryClient.invalidateQueries({
          queryKey: ["dataAppSessions"],
          exact: false,
        })
      }
    />
  );
}
