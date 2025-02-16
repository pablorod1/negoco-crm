import React from "react";
import styled from "styled-components";

interface Props {
  onPress: () => void;
}

export default function AnimatedButton({ onPress }: Props) {
  return (
    <StyledWrapper>
      <button onClick={onPress}>Crear Trámite</button>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  button {
    position: relative;
    width: 200px;
    border: none;
    background: var(--primary-color-600);
    color: white;
    padding: 1em;
    font-weight: bold;
    text-transform: uppercase;
    transition: 0.2s;
    border-radius: 5px;
    opacity: 0.8;
    letter-spacing: 1px;
    box-shadow: var(--primary-color-800) 0px 7px 2px, #000 0px 8px 5px;
  }

  button:hover {
    opacity: 1;
  }

  button:active {
    top: 4px;
    box-shadow: var(--primary-color-800) 0px 3px 2px, #000 0px 3px 5px;
  }
`;
