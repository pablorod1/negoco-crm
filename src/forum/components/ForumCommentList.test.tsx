import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ForumCommentList } from "./ForumCommentList";
import type { ForumComment } from "@/forum/types";

const baseComment: ForumComment = {
  id: "comment1",
  topic_id: "topic1",
  message: "Contenido del comentario",
  author_label: "Usuario 1",
  author_id: "user1",
  author_name: "Persona Real",
  author_email: "persona@test.com",
  author_role: "2",
  created_at: "2026-06-16T08:00:00.000Z",
  updated_at: "2026-06-16T08:00:00.000Z",
  is_hidden: false,
};

describe("ForumCommentList", () => {
  test("renders pseudonymous authors for non-management users", () => {
    render(<ForumCommentList comments={[baseComment]} isDireccion={false} />);

    expect(screen.getByText("Usuario 1")).toBeInTheDocument();
    expect(screen.getByText("Contenido del comentario")).toBeInTheDocument();
    expect(screen.queryByText(/Persona Real/)).not.toBeInTheDocument();
    expect(screen.queryByText(/persona@test.com/)).not.toBeInTheDocument();
  });

  test("renders real identity for management users", () => {
    render(<ForumCommentList comments={[baseComment]} isDireccion />);

    expect(screen.getByText("Usuario 1")).toBeInTheDocument();
    expect(screen.getByText(/Persona Real/)).toBeInTheDocument();
    expect(screen.getByText(/persona@test.com/)).toBeInTheDocument();
  });

  test("lets management toggle hidden state", () => {
    const onToggleHidden = vi.fn();
    render(
      <ForumCommentList
        comments={[baseComment]}
        isDireccion
        onToggleHidden={onToggleHidden}
      />,
    );

    fireEvent.click(screen.getByLabelText("Ocultar comentario"));

    expect(onToggleHidden).toHaveBeenCalledWith(baseComment);
  });
});
