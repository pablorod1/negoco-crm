"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useUser } from "@/lib/contexts/UserContext";
import AvatarComponent from "../AvatarComponent";
import {
  User,
  TramiteDB,
  ClientDB,
  ComparativaVM,
  FotovoltaicaVM,
  ContractDB,
} from "@/lib/core/types";
import ChatbotTramitesTable from "./ChatbotTramitesTable";
import ChatbotClientsTable from "./ChatbotClientsTable";
import ChatbotComparativasTable from "./ChatbotComparativasTable";
import ChatbotFotovoltaicaTable from "./ChatbotFotovoltaicaTable";
import ChatbotContractsTable from "./ChatbotContractsTable";
import ChatbotGeneralDataTable, {
  GeneralData,
} from "./ChatbotGeneralDataTable";

type Message = {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  suggestions?: string[];
  tableData?: (
    | TramiteDB
    | ClientDB
    | ComparativaVM
    | FotovoltaicaVM
    | ContractDB
    | User
    | GeneralData
  )[];
  queryType?: "database" | "general";
  dataType?:
    | "tramites"
    | "clients"
    | "comparativas"
    | "fotovoltaica"
    | "contracts"
    | "files"
    | "signers"
    | "general_data";
  originalQuery?: string;
};

export default function Chatbot() {
  const { userData } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "¡Hola! Soy tu asistente virtual de Negoco Cloud. Puedo ayudarte con consultas sobre trámites, clientes, comparativas y más. También puedo recordar nuestra conversación anterior para responder preguntas de seguimiento. ¿En qué puedo ayudarte hoy?",
      role: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !userData || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    try {
      // Prepare conversation history (exclude current message)
      const conversationHistory = messages.slice(-6).map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
      }));

      // Llamada real a la API
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: currentInput,
          super_id: userData.super_id,
          conversationHistory: conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor");
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: "assistant",
        timestamp: new Date(),
        suggestions: data.suggestions,
        tableData: data.tableData,
        queryType: data.queryType,
        dataType: data.dataType,
        originalQuery: data.originalQuery,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error al enviar mensaje:", error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          "Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.",
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };
  const handleNewConversation = () => {
    setMessages([
      {
        id: "1",
        content:
          "¡Hola! Soy tu asistente virtual de Negoco Cloud. Puedo ayudarte con consultas sobre trámites, clientes, comparativas y más. También puedo recordar nuestra conversación anterior para responder preguntas de seguimiento. ¿En qué puedo ayudarte hoy?",
        role: "assistant",
        timestamp: new Date(),
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full">
            <Image
              src="/icons/negoco-ai-full.webp"
              alt="Negoco Cloud AI"
              width={32}
              height={32}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Negoco Cloud AI</h1>{" "}
            <p className="text-sm text-muted-foreground">
              Tu asistente energético conversacional
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewConversation}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nueva conversación
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-8">
        <div className="max-w-4xl mx-auto py-8 space-y-8">
          {messages.length === 1 && (
            <div className="text-center space-y-6 py-16">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Image
                  src="/icons/negoco-ai-full.webp"
                  alt="Negoco Cloud AI"
                  width={32}
                  height={32}
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">
                  ¿En qué puedo ayudarte hoy?
                </h2>{" "}
                <p className="text-muted-foreground">
                  Soy tu asistente especializado en temas energéticos y gestión
                  comercial. Puedo recordar nuestra conversación para ayudarte
                  con preguntas de seguimiento.
                </p>
              </div>{" "}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {[
                  "Busca mis trámites activos de junio",
                  "Encuentra trámites pendientes de cobro",
                  "¿Qué documentos necesito para un trámite?",
                  "Explícame las tarifas eléctricas actuales",
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors text-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-4 group",
                message.role === "user" ? "flex-row-reverse" : ""
              )}
            >
              <div className="flex-shrink-0">
                {message.role === "assistant" ? (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Image
                      src="/icons/negoco-ai-full.webp"
                      alt="AI"
                      width={20}
                      height={20}
                      className="w-5 h-5 object-contain"
                    />
                  </div>
                ) : (
                  <AvatarComponent
                    userData={userData as User}
                    className="w-8 h-8 rounded-full"
                  />
                )}
              </div>

              <div className="flex-1 space-y-3">
                {" "}
                <div
                  className={cn(
                    "text-sm leading-relaxed space-y-4",
                    message.role === "user" ? "text-right" : ""
                  )}
                >
                  <div
                    className={cn(
                      "inline-block p-4 rounded-2xl max-w-[80%] break-words whitespace-pre-wrap",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted"
                    )}
                  >
                    {message.content}
                  </div>{" "}
                  {/* Table data for database queries */}
                  {message.role === "assistant" &&
                    message.queryType === "database" &&
                    message.tableData &&
                    message.tableData.length > 0 && (
                      <div className="w-full">
                        {" "}
                        {message.dataType === "clients" && (
                          <ChatbotClientsTable
                            data={message.tableData as ClientDB[]}
                            query={message.originalQuery || "consulta"}
                            userData={userData as User}
                          />
                        )}
                        {message.dataType === "tramites" && (
                          <ChatbotTramitesTable
                            data={message.tableData as TramiteDB[]}
                            query={message.originalQuery || "consulta"}
                            userData={userData as User}
                          />
                        )}
                        {message.dataType === "comparativas" && (
                          <ChatbotComparativasTable
                            data={message.tableData as ComparativaVM[]}
                            query={message.originalQuery || "consulta"}
                            userData={userData as User}
                          />
                        )}
                        {message.dataType === "fotovoltaica" && (
                          <ChatbotFotovoltaicaTable
                            data={message.tableData as FotovoltaicaVM[]}
                            query={message.originalQuery || "consulta"}
                            userData={userData as User}
                          />
                        )}{" "}
                        {message.dataType === "contracts" && (
                          <ChatbotContractsTable
                            data={message.tableData as ContractDB[]}
                            query={message.originalQuery || "consulta"}
                            userData={userData as User}
                          />
                        )}
                        {(message.dataType === "files" ||
                          message.dataType === "signers" ||
                          message.dataType === "general_data") && (
                          <ChatbotGeneralDataTable
                            data={message.tableData as GeneralData[]}
                            query={message.originalQuery || "consulta"}
                            userData={userData as User}
                          />
                        )}
                      </div>
                    )}
                </div>
                {/* Suggestions */}
                {message.role === "assistant" &&
                  message.suggestions &&
                  message.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">
                        Consultas relacionadas:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors border border-primary/20"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-muted-foreground">
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Image
                  src="/icons/negoco-ai-full.webp"
                  alt="AI"
                  width={20}
                  height={20}
                  className="w-5 h-5 object-contain"
                />
              </div>
              <div className="flex-1">
                <div className="inline-block p-4 rounded-2xl bg-muted">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Pensando...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto p-4">
          <form onSubmit={handleSendMessage} className="relative">
            <div className="relative flex items-center gap-3 p-3 border rounded-2xl bg-background focus-within:ring-1 focus-within:ring-ring">
              <textarea
                ref={textareaRef}
                placeholder="Escribe tu consulta energética..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                rows={1}
                className="flex-1 resize-none bg-transparent border-0 focus:outline-none text-sm  placeholder:text-muted-foreground overflow-hidden"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !input.trim()}
                className="rounded-xl p-2 h-8 w-8"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Presiona Enter para enviar, Shift + Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  );
}
