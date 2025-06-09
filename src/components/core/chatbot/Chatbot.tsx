"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { X, Send } from "lucide-react";
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
};

export default function Chatbot() {
  const { userData } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hola, soy tu asistente virtual de EnergiCRM. ¿En qué puedo ayudarte hoy con tus consultas energéticas?",
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulate assistant response after a short delay
    setTimeout(() => {
      const assistantResponses = [
        "Puedo ayudarte a analizar tu consumo energético y encontrar oportunidades de ahorro.",
        "¿Te gustaría programar una auditoría energética para tu empresa?",
        "Tenemos nuevos planes de consultoría para optimización de recursos energéticos.",
        "Basado en tus datos, podrías reducir hasta un 20% tu factura implementando energías renovables.",
      ];

      const randomResponse =
        assistantResponses[
          Math.floor(Math.random() * assistantResponses.length)
        ];

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: randomResponse,
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
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
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white p-1">
                  <Image
                    src="/icons/negoco-ai.webp"
                    alt="Negoco Cloud Logo"
                    width={48}
                    height={48}
                    className="w-full h-auto object-contain"
                  />
                </div>
                <h3 className="font-semibold">Asistente Negoco Cloud</h3>
              </div>
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
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    message.role === "user" ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className="w-32 h-32 rounded-full">
                      <Image
                        src="/icons/negoco-ai-full.webp"
                        alt="Negoco Cloud Logo"
                        width={48}
                        height={48}
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  ) : (
                    <AvatarComponent
                      userData={userData as User}
                      className="rounded-full w-8 h-8"
                    />
                  )}
                  <div>
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
              ))}
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
              />
              <Button type="submit" size="icon">
                <Send className="h-4 w-4" />
                <span className="sr-only">Enviar mensaje</span>
              </Button>
            </form>
          </CardFooter>
        </Card>
      ) : (
        <Button
          onClick={toggleChat}
          size="icon"
          className="h-14 w-14 rounded-full shadow-xl bg-white p-2"
        >
          <Image
            src="/icons/negoco-ai.webp"
            alt="Negoco Cloud Logo"
            width={24}
            height={24}
            className="w-full h-auto object-contain"
          />
        </Button>
      )}
    </div>
  );
}
