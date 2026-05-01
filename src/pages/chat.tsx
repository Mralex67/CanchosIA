import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetOpenaiConversation,
  useListOpenaiSuggestedPrompts,
  getGetOpenaiConversationQueryKey,
  getListOpenaiConversationsQueryKey,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Loader2,
  SendHorizontal,
  Sparkles,
  User,
  ImageIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "@/hooks/use-toast";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export default function ChatPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const conversationId = id ? parseInt(id, 10) : null;

  const { data: conversation, isLoading: isLoadingConversation } =
    useGetOpenaiConversation(conversationId!, {
      query: {
        enabled: !!conversationId,
        queryKey: getGetOpenaiConversationQueryKey(conversationId!),
      },
    });

  const { data: suggestedPrompts, isLoading: isLoadingPrompts } =
    useListOpenaiSuggestedPrompts();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (conversation?.messages) {
      setMessages(conversation.messages as ChatMessage[]);
    } else if (!conversationId) {
      setMessages([]);
    }
  }, [conversation, conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, streamingContent, streamingStatus]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const insertImageCommand = () => {
    const next = input.startsWith("/imagen")
      ? input
      : `/imagen ${input}`.trim();
    setInput(next);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    });
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    const messageContent = content.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let targetConversationId = conversationId;

    if (!targetConversationId) {
      try {
        const titleSeed =
          messageContent.replace(/^\/imagen\s+/i, "").trim() || messageContent;
        const createRes = await fetch(`/api/conversations`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:
              titleSeed.substring(0, 30) + (titleSeed.length > 30 ? "..." : ""),
          }),
        });
        if (!createRes.ok) throw new Error("Failed to create conversation");
        const newConv = await createRes.json();
        targetConversationId = newConv.id;
        queryClient.invalidateQueries({
          queryKey: getListOpenaiConversationsQueryKey(),
        });
        setLocation(`/chat/${targetConversationId}`, { replace: true });
      } catch {
        toast({
          title: "Error al iniciar conversación",
          variant: "destructive",
        });
        return;
      }
    }

    const tempId = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: messageContent,
        createdAt: new Date().toISOString(),
      },
    ]);

    setIsStreaming(true);
    setStreamingContent("");
    setStreamingStatus(null);

    try {
      const res = await fetch(
        `/api/conversations/${targetConversationId}/messages`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: messageContent }),
        },
      );

      if (!res.ok || !res.body) throw new Error("Error en la respuesta");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6).trim();
          if (!dataStr || dataStr === "[DONE]") continue;
          try {
            const data = JSON.parse(dataStr);
            if (data.done) break;
            if (data.error) throw new Error(data.error);
            if (data.status) setStreamingStatus(data.status);
            if (data.content) {
              fullContent += data.content;
              setStreamingContent(fullContent);
              setStreamingStatus(null);
            }
          } catch (e) {
            console.error("Error parsing SSE JSON", e, dataStr);
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: fullContent,
          createdAt: new Date().toISOString(),
        },
      ]);

      queryClient.invalidateQueries({
        queryKey: getGetOpenaiConversationQueryKey(targetConversationId!),
      });
      queryClient.invalidateQueries({
        queryKey: getListOpenaiConversationsQueryKey(),
      });
    } catch {
      toast({
        title: "Error de conexión",
        description: "No pudimos enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      setStreamingStatus(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (conversationId && isLoadingConversation) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderAssistantContent = (content: string, suffix?: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        img: ({ ...props }) => (
          <img
            {...props}
            className="rounded-xl border border-border max-w-full h-auto my-3"
            loading="lazy"
            alt={typeof props.alt === "string" ? props.alt : "imagen generada"}
          />
        ),
      }}
    >
      {content + (suffix ?? "")}
    </ReactMarkdown>
  );

  return (
    <div className="flex flex-col h-full bg-background relative">
      {(!conversationId || messages.length === 0) &&
        !isStreaming &&
        streamingContent === "" && (
          <ScrollArea className="flex-1 px-4 py-8">
            <div className="max-w-3xl mx-auto w-full pb-32">
              <div className="text-center mb-12 mt-8">
                <img
                  src="/cochis_logo.png"
                  alt="Cochis IA"
                  className="w-20 h-20 mx-auto mb-6 object-cover rounded-2xl shadow-md border border-border"
                />
                <h2 className="text-3xl font-display font-bold mb-3">
                  ¿En qué te puedo ayudar hoy?
                </h2>
                <p className="text-muted-foreground font-light">
                  Pregúntame lo que sea o pídeme una imagen con{" "}
                  <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">
                    /imagen ...
                  </code>
                </p>
              </div>

              {isLoadingPrompts ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-24 bg-muted/50 animate-pulse rounded-xl"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {suggestedPrompts?.slice(0, 4).map((prompt) => (
                    <Card
                      key={prompt.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors bg-card hover:bg-muted/30 shadow-sm"
                      onClick={() => sendMessage(prompt.prompt)}
                    >
                      <CardHeader className="p-4 pb-2 flex flex-row items-center gap-3">
                        {prompt.prompt.startsWith("/imagen") ? (
                          <ImageIcon className="w-5 h-5 text-primary" />
                        ) : (
                          <Sparkles className="w-5 h-5 text-primary" />
                        )}
                        <CardTitle className="text-sm font-semibold font-display uppercase tracking-wider text-muted-foreground">
                          {prompt.category}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-sm font-medium">{prompt.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {prompt.prompt}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

      {(messages.length > 0 || isStreaming) && (
        <ScrollArea ref={scrollRef} className="flex-1 px-4">
          <div className="max-w-3xl mx-auto w-full py-8 pb-32 space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex gap-4 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border overflow-hidden ${
                        msg.role === "user"
                          ? "bg-secondary text-secondary-foreground border-secondary/50"
                          : "bg-card border-border"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <img
                          src="/cochis_logo.png"
                          alt="Cochis"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div
                      className={`rounded-2xl px-5 py-3.5 shadow-sm text-[15px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-muted text-foreground border border-border"
                          : "bg-card border border-border/50 prose prose-sm md:prose-base prose-neutral dark:prose-invert max-w-none"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        renderAssistantContent(msg.content)
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex w-full justify-start"
                >
                  <div className="flex gap-4 max-w-[85%] flex-row">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border bg-card border-border overflow-hidden">
                      <img
                        src="/cochis_logo.png"
                        alt="Cochis"
                        className="w-full h-full object-cover animate-pulse"
                      />
                    </div>
                    <div className="rounded-2xl px-5 py-3.5 shadow-sm text-[15px] leading-relaxed bg-card border border-border/50 prose prose-sm md:prose-base prose-neutral dark:prose-invert max-w-none min-h-[50px]">
                      {streamingContent ? (
                        renderAssistantContent(streamingContent, " ▍")
                      ) : streamingStatus ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground not-prose">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{streamingStatus}</span>
                        </div>
                      ) : (
                        <div className="flex items-center h-full gap-1 not-prose">
                          <span
                            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}

      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-background via-background to-transparent pt-6 pb-6 px-4">
        <div className="max-w-3xl mx-auto w-full relative">
          <div className="relative flex items-end w-full rounded-3xl bg-card border border-border shadow-lg focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all overflow-hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full w-10 h-10 ml-2 mb-2 shrink-0 text-muted-foreground hover:text-primary"
              onClick={insertImageCommand}
              title="Generar imagen"
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje, o /imagen <descripción> para generar"
              className="min-h-[56px] max-h-[200px] w-full resize-none bg-transparent border-0 focus-visible:ring-0 px-2 py-4 text-[15px] leading-relaxed scrollbar-hide"
              rows={1}
              disabled={isStreaming}
            />
            <div className="p-2 shrink-0 h-[56px] flex items-center">
              <Button
                size="icon"
                className={`rounded-full w-10 h-10 transition-all ${
                  input.trim() && !isStreaming
                    ? "bg-primary text-primary-foreground shadow-md hover:scale-105"
                    : "bg-muted text-muted-foreground opacity-50"
                }`}
                disabled={!input.trim() || isStreaming}
                onClick={() => sendMessage(input)}
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <SendHorizontal className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="text-center mt-2 text-xs text-muted-foreground font-light">
            Cochis IA puede cometer errores. Verifica la información importante.
          </div>
        </div>
      </div>
    </div>
  );
}
