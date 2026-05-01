import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

export type Conversation = {
  id: number;
  userId: number | null;
  title: string;
  createdAt: string;
};

export type Message = {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  imageUrl: string | null;
  createdAt: string;
};

export type ConversationWithMessages = Conversation & { messages: Message[] };

export type SuggestedPrompt = {
  id: number;
  category: string;
  title: string;
  prompt: string;
};

const API_BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const queryKeys = {
  conversations: () => ["conversations"] as const,
  conversation: (id: number) => ["conversations", id] as const,
  messages: (id: number) => ["conversations", id, "messages"] as const,
  suggestedPrompts: () => ["suggested-prompts"] as const,
};

export const getListOpenaiConversationsQueryKey = queryKeys.conversations;
export const getGetOpenaiConversationQueryKey = queryKeys.conversation;
export const getListOpenaiMessagesQueryKey = queryKeys.messages;
export const getListOpenaiSuggestedPromptsQueryKey = queryKeys.suggestedPrompts;

export function useListOpenaiConversations(
  options?: Omit<UseQueryOptions<Conversation[]>, "queryKey" | "queryFn">,
) {
  return useQuery<Conversation[]>({
    queryKey: queryKeys.conversations(),
    queryFn: () => request<Conversation[]>("/conversations"),
    ...options,
  });
}

export function useGetOpenaiConversation(
  id: number,
  options?: {
    query?: Omit<UseQueryOptions<ConversationWithMessages>, "queryFn"> & {
      enabled?: boolean;
    };
  },
) {
  return useQuery<ConversationWithMessages>({
    queryKey: queryKeys.conversation(id),
    queryFn: () => request<ConversationWithMessages>(`/conversations/${id}`),
    enabled: id != null && id > 0,
    ...(options?.query ?? {}),
  });
}

export function useListOpenaiSuggestedPrompts() {
  return useQuery<SuggestedPrompt[]>({
    queryKey: queryKeys.suggestedPrompts(),
    queryFn: () => request<SuggestedPrompt[]>("/suggested-prompts"),
    staleTime: 1000 * 60 * 60,
  });
}

export function useCreateOpenaiConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { data: { title: string } }) =>
      request<Conversation>("/conversations", {
        method: "POST",
        body: JSON.stringify(vars.data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations() });
    },
  });
}

export function useDeleteOpenaiConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number }) =>
      request<void>(`/conversations/${vars.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations() });
    },
  });
}
