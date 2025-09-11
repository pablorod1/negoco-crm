import { useState } from "react";

type MainView = "main" | "cliente" | "documentos" | "tickets" | "historial";
type TicketsView = "list" | "detail";

interface UseViewNavigationReturn {
  currentView: MainView;
  ticketsView: TicketsView;
  selectedTicketId: string | null;
  setCurrentView: (view: MainView) => void;
  setTicketsView: (view: TicketsView) => void;
  setSelectedTicketId: (id: string | null) => void;
  resetToMain: () => void;
  navigateToTicketDetail: (ticketId: string) => void;
  navigateToTicketsList: () => void;
}

export function useViewNavigation(): UseViewNavigationReturn {
  const [currentView, setCurrentView] = useState<MainView>("main");
  const [ticketsView, setTicketsView] = useState<TicketsView>("list");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const resetToMain = () => {
    setCurrentView("main");
    setTicketsView("list");
    setSelectedTicketId(null);
  };

  const navigateToTicketDetail = (ticketId: string) => {
    setCurrentView("tickets");
    setTicketsView("detail");
    setSelectedTicketId(ticketId);
  };

  const navigateToTicketsList = () => {
    setCurrentView("tickets");
    setTicketsView("list");
    setSelectedTicketId(null);
  };

  return {
    currentView,
    ticketsView,
    selectedTicketId,
    setCurrentView,
    setTicketsView,
    setSelectedTicketId,
    resetToMain,
    navigateToTicketDetail,
    navigateToTicketsList,
  };
}
