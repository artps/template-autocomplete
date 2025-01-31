import React, {
  useState,
  useEffect,
  useRef,
  KeyboardEvent,
  FC,
  ReactNode,
} from "react";
import ReactDOM from "react-dom";
import {
  Editor,
  EditorState,
  Modifier,
  SelectionState,
  CompositeDecorator,
  ContentBlock,
  ContentState,
  DraftHandleValue,
  getDefaultKeyBinding,
  DraftEditorCommand,
} from "draft-js";
import "draft-js/dist/Draft.css";

const SUGGESTIONS = ["React", "Redux", "DraftJS", "TypeScript"];

interface Position {
  top: number;
  left: number;
}

interface DropdownPortalProps {
  children: ReactNode;
}

/**
 * A self-contained Portal component that:
 *  - Creates a <div> on mount
 *  - Appends it to document.body (or anywhere else you choose)
 *  - Removes it on unmount
 *  - Renders `children` inside that <div> using createPortal()
 */
const DropdownPortal: FC<DropdownPortalProps> = ({ children }) => {
  // We create the container div once, store it in state so it survives re-renders
  const [containerEl] = useState(() => {
    const el = document.createElement("div");
    el.id = "dropdown-portal-container";
    return el;
  });

  useEffect(() => {
    document.body.appendChild(containerEl);

    return () => {
      document.body.removeChild(containerEl);
    };
  }, [containerEl]);

  return ReactDOM.createPortal(children, containerEl);
};

/* Decorator for Draft.js entities */
function findAutocompleteEntities(
  contentBlock: ContentBlock,
  callback: (start: number, end: number) => void,
  contentState: ContentState
): void {
  contentBlock.findEntityRanges((char) => {
    const entityKey = char.getEntity();
    if (!entityKey) return false;
    return contentState.getEntity(entityKey).getType() === "AUTOCOMPLETE_ENTRY";
  }, callback);
}

interface AutocompleteTokenProps {
  children: ReactNode;
}

const AutocompleteToken: FC<AutocompleteTokenProps> = ({ children }) => {
  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: "#f6f6f6",
        color: "#d33",
        padding: "0 4px",
        borderRadius: 4,
      }}
      contentEditable={false}
    >
      {children}
    </span>
  );
};

const decorator = new CompositeDecorator([
  {
    strategy: findAutocompleteEntities,
    component: (props: AutocompleteTokenProps) => (
      <AutocompleteToken {...props} />
    ),
  },
]);

const AutocompleteEditor: FC = () => {
  const [editorState, setEditorState] = useState(() =>
    EditorState.createEmpty(decorator)
  );
  const [autocompleteActive, setAutocompleteActive] = useState<boolean>(false);
  const [matchString, setMatchString] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>(SUGGESTIONS);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // The dropdown position
  const [dropdownPos, setDropdownPos] = useState<Position>({ top: 0, left: 0 });

  // For comparing old/new text to detect typed characters
  const prevTextRef = useRef<string>("");

  // Ref to the Draft.js Editor
  const editorRef = useRef<Editor>(null);

  /**
   * onChange: update editorState and check for newly typed "<>"
   */
  const onChange = (newEditorState: EditorState) => {
    setEditorState(newEditorState);

    const newText = newEditorState.getCurrentContent().getPlainText();
    const oldText = prevTextRef.current;
    prevTextRef.current = newText;

    console.log(newEditorState.getSelection().getStartOffset());

    // Check for newly typed "<>"
    if (newText.length === oldText.length + 1) {
      const selectionOffset = newEditorState.getSelection().getStartOffset();
      const typedChar = newText[selectionOffset - 1];
      if (
        !autocompleteActive &&
        typedChar === ">" &&
        newText[selectionOffset - 2] === "<"
      ) {
        setAutocompleteActive(true);
        setMatchString("");
        setSuggestions(SUGGESTIONS);
        setSelectedIndex(0);
      }
    }

    // If we're in autocomplete mode, update the match string
    if (autocompleteActive) {
      const selectionOffset = newEditorState.getSelection().getStartOffset();
      const lastTriggerIndex = newText.lastIndexOf("<>");
      if (lastTriggerIndex === -1) {
        // If "<>" is removed, close autocomplete
        setAutocompleteActive(false);
      } else {
        // substring from right of "<>" to cursor
        const typedSubstring = newText.substring(
          lastTriggerIndex + 2,
          selectionOffset
        );
        setMatchString(typedSubstring);

        // Filter suggestions
        const filtered = SUGGESTIONS.filter((sug) =>
          sug.toLowerCase().startsWith(typedSubstring.toLowerCase())
        );
        setSuggestions(filtered.length ? filtered : [typedSubstring]);

        if (selectedIndex >= filtered.length) {
          setSelectedIndex(0);
        }
      }
    }
  };

  /**
   * Custom key binding to handle arrow keys, enter, tab, escape, backspace
   */
  const myKeyBindingFn = (
    e: KeyboardEvent
  ): DraftEditorCommand | string | null => {
    if (e.key === "ArrowDown") return "arrow-down";
    if (e.key === "ArrowUp") return "arrow-up";
    if (e.key === "Enter") return "enter";
    if (e.key === "Tab") return "tab";
    if (e.key === "Escape") return "escape";
    if (e.key === "Backspace") return "backspace";
    return getDefaultKeyBinding(e);
  };

  /**
   * handleKeyCommand handles commands from myKeyBindingFn
   */
  const handleKeyCommand = (
    command: string,
    currentEditorState: EditorState
  ): DraftHandleValue => {
    if (autocompleteActive) {
      if (command === "arrow-down") {
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return "handled";
      }

      if (command === "arrow-up") {
        setSelectedIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length
        );
        return "handled";
      }

      if (command === "enter" || command === "tab") {
        const suggestion = suggestions[selectedIndex] || matchString;
        insertSuggestion(suggestion);
        return "handled";
      }

      if (command === "escape") {
        setAutocompleteActive(false);
        return "handled";
      }
    }

    // If user pressed backspace, try removing a token
    if (command === "backspace") {
      const newState = tryRemoveToken(currentEditorState);
      if (newState) {
        setEditorState(newState);
        return "handled";
      }
    }

    return "not-handled";
  };

  /**
   * Insert suggestion as an IMMUTABLE entity or fallback to raw text
   */
  const insertSuggestion = (suggestion: string) => {
    let content = editorState.getCurrentContent();
    const selection = editorState.getSelection();
    const endOffset = selection.getStartOffset();

    const blockKey = selection.getStartKey();
    const blockText = content.getBlockForKey(blockKey).getText();
    // Check for the "<>" in the block
    const startOffset = blockText.lastIndexOf("<>", endOffset - 2);

    if (startOffset !== -1) {
      const range = new SelectionState({
        anchorKey: blockKey,
        anchorOffset: startOffset,
        focusKey: blockKey,
        focusOffset: endOffset,
      });

      content = content.createEntity("AUTOCOMPLETE_ENTRY", "IMMUTABLE", {
        text: suggestion,
      });
      const entityKey = content.getLastCreatedEntityKey();

      content = Modifier.replaceText(
        content,
        range,
        suggestion,
        undefined,
        entityKey
      );
    } else {
      // Fallback insertion at cursor
      content = Modifier.insertText(content, selection, suggestion);
    }

    let newEditorState = EditorState.push(
      editorState,
      content,
      "insert-characters"
    );

    // @TODO: Workaround for caret getting trapped inside immutable autocomplete entities.
    //
    // Immutable entities have `contenteditable=false`, which prevents the caret from escaping naturally.
    // While `EditorState.forceSelection()` should theoretically update the selection, Draft.js and
    // the browser’s native behavior often fail to move the cursor correctly due to the lack of a valid
    // text node after the entity.
    //
    // To resolve this, we insert a zero-width space (`\u200B`) immediately after the entity.
    // This provides a valid text position for the caret to land on, ensuring smooth navigation.
    //
    // Alternative approaches like `forceSelection()` alone do not reliably fix this issue,
    // as Draft.js cannot always override native selection behavior in contenteditable elements.
    newEditorState = EditorState.push(
      newEditorState,
      Modifier.insertText(
        newEditorState.getCurrentContent(),
        newEditorState.getSelection(),
        "\u200B"
      ),
      "insert-characters"
    );

    // Move the cursor after the newly inserted token
    const newOffset =
      (startOffset === -1 ? endOffset : startOffset) + suggestion.length;

    const newSelection = new SelectionState({
      anchorKey: blockKey,
      anchorOffset: newOffset,
      focusKey: blockKey,
      focusOffset: newOffset,
    });
    newEditorState = EditorState.forceSelection(newEditorState, newSelection);

    setEditorState(newEditorState);
    setAutocompleteActive(false);
  };

  /**
   * Remove an entire token on backspace if the cursor is immediately after it
   */
  const tryRemoveToken = (currentState: EditorState): EditorState | null => {
    const selection = currentState.getSelection();
    if (!selection.isCollapsed()) return null;

    const content = currentState.getCurrentContent();
    const offset = selection.getStartOffset();
    const blockKey = selection.getStartKey();
    const block = content.getBlockForKey(blockKey);

    if (offset === 0) {
      return null;
    }

    const charBefore = block.getCharacterList().get(offset - 1);
    const entityKey = charBefore?.getEntity();

    if (!entityKey) {
      return null;
    }

    const entity = content.getEntity(entityKey);
    if (entity.getType() !== "AUTOCOMPLETE_ENTRY") {
      return null;
    }

    // Expand selection to cover the entire token
    let start = offset - 1;
    let end = offset;

    while (start > 0) {
      const c = block.getCharacterList().get(start - 1);
      if (!c || c.getEntity() !== entityKey) break;
      start--;
    }

    while (end < block.getLength()) {
      const c = block.getCharacterList().get(end);
      if (!c || c.getEntity() !== entityKey) break;
      end++;
    }

    const tokenRange = selection.merge({
      anchorOffset: start,
      focusOffset: end,
    }) as SelectionState;

    const newContent = Modifier.removeRange(content, tokenRange, "backward");

    const newState = EditorState.push(currentState, newContent, "remove-range");

    const collapseSel = tokenRange.merge({
      anchorOffset: start,
      focusOffset: start,
    }) as SelectionState;

    return EditorState.forceSelection(newState, collapseSel);
  };

  /**
   * Measure the caret location and set dropdownPos for absolute positioning
   */
  const updateDropdownPosition = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0).cloneRange();
    range.collapse(false);
    const rect = range.getBoundingClientRect();

    setDropdownPos({
      top: rect.bottom + window.scrollY + 5,
      left: rect.left + window.scrollX,
    });
  };

  /**
   * Whenever the editorState changes, if autocomplete is active,
   * we recalc the dropdown position (on next tick).
   */
  useEffect(() => {
    if (autocompleteActive) {
      setTimeout(() => {
        updateDropdownPosition();
      }, 0);
    }
  }, [editorState, autocompleteActive]);

  return (
    <div
      style={{
        width: 640,
        margin: "2rem auto",
        position: "relative",
      }}
    >
      <div
        style={{
          minHeight: 320,
          border: "1px solid #ccc",
          padding: 8,
        }}
        onClick={() => editorRef.current?.focus()}
      >
        <Editor
          ref={editorRef}
          editorState={editorState}
          onChange={onChange}
          keyBindingFn={myKeyBindingFn}
          handleKeyCommand={handleKeyCommand}
        />
      </div>

      {/* If autocomplete is active, show the dropdown in the portal */}
      {autocompleteActive && (
        <DropdownPortal>
          <div
            style={{
              position: "absolute",
              top: dropdownPos.top,
              left: dropdownPos.left,
              background: "#fff",
              border: "1px solid #ccc",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              width: 200,
              zIndex: 9999,
            }}
          >
            {suggestions.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item}
                  style={{
                    padding: "6px 12px",
                    cursor: "pointer",
                    backgroundColor: isSelected ? "#eee" : "#fff",
                  }}
                  onMouseDown={() => insertSuggestion(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  {item}
                </div>
              );
            })}
          </div>
        </DropdownPortal>
      )}
    </div>
  );
};

export default AutocompleteEditor;
