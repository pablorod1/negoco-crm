"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useUser } from "@/lib/contexts/UserContext";
import AvatarComponent from "../AvatarComponent";
import { User } from "@/lib/core/types";

type Message = {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  suggestions?: string[];
};

export default function Chatbot() {
  const { userData } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hola, soy tu asistente virtual de Negoco Cloud. ¿En qué puedo ayudarte hoy?",
      role: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Llamada real a la API
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input,
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
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const toggleChat = () => {
    setIsOpen((prev) => !prev);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <Card className="w-80 md:w-96 shadow-lg border-green-100 overflow-hidden">
          <CardHeader className="p-4 bg-gradient-to-r from-primary-600 to-primary-600 text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Negoco Cloud AI</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleChat}
                className="text-white hover:bg-primary-700 hover:text-white"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar chat</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="h-96 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  <div
                    className={cn(
                      "flex gap-3 max-w-[85%]",
                      message.role === "user" ? "ml-auto flex-row-reverse" : ""
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="w-8 h-8 rounded-full flex-shrink-0">
                        <Image
                          src="/icons/negoco-ai-full.webp"
                          alt="Negoco Cloud Logo"
                          width={32}
                          height={32}
                          className="w-full h-full object-contain rounded-full"
                        />
                      </div>
                    ) : (
                      <AvatarComponent
                        userData={userData as User}
                        className="rounded-full w-8 h-8 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <div
                        className={cn(
                          "rounded-lg p-3",
                          message.role === "assistant"
                            ? "bg-muted border border-border"
                            : "bg-primary text-primary-foreground"
                        )}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>

                  {/* Mostrar sugerencias si las hay */}
                  {message.role === "assistant" &&
                    message.suggestions &&
                    message.suggestions.length > 0 && (
                      <div className="ml-11 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Consultas relacionadas:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {message.suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              ))}

              {/* Mostrar indicador de carga */}
              {isLoading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full flex-shrink-0">
                    <Image
                      src="/icons/negoco-ai-full.webp"
                      alt="Negoco Cloud Logo"
                      width={32}
                      height={32}
                      className="w-full h-full object-contain rounded-full"
                    />
                  </div>
                  <div className="bg-muted border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-sm text-muted-foreground">
                        Escribiendo...
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </CardContent>

          <CardFooter className="p-3 border-t">
            <form onSubmit={handleSendMessage} className="flex w-full gap-2">
              <Input
                ref={inputRef}
                placeholder="Escribe tu consulta energética..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="sr-only">Enviar mensaje</span>
              </Button>
            </form>
          </CardFooter>
        </Card>
      ) : (
        <Button
          onClick={toggleChat}
          size="icon"
          className="h-14 w-14 rounded-full shadow-xl bg-white p-2 hover:bg-white/90 transition-colors"
        >
          <Image
            src="/icons/negoco-ai.webp"
            alt="Negoco Cloud Logo"
            width={400}
            height={400}
            className="w-full h-auto object-contain"
          />
        </Button>
      )}
    </div>
  );
}
