# Draft.js Autocomplete Editor

## Overview

The **Draft.js Autocomplete Editor** is a rich text editor built with [React](https://reactjs.org/) and [Draft.js](https://draftjs.org/), featuring a custom autocomplete system. The editor allows users to type freely while providing inline suggestions triggered by specific character sequences.

## Features

- **Rich Text Editing** – Supports standard text editing functionalities including typing, selecting, copying, pasting, and cutting.
- **Custom Autocomplete Trigger** – Autocomplete is activated when the user types `<>`.
- **Dynamic Suggestions** – A dropdown dynamically updates based on the user’s input, showing matching suggestions.
- **Keyboard Navigation** – Users can navigate suggestions using the arrow keys and select a suggestion with `Enter` or `Tab`.
- **Mouse Interaction** – Suggestions can be clicked to insert them into the editor.
- **Immutable Tokens** – Once a suggestion is selected, it appears as a **non-editable token** that can only be deleted with a single `Backspace` press.
- **Portal-Based Dropdown** – Uses React Portals to render the suggestion dropdown outside the editor’s DOM hierarchy, ensuring proper positioning and avoiding styling conflicts.

## Live Demo

A live demo of the editor is available [here](https://draftjs-autocomplete-82yhvz7im-art-semyonovs-projects.vercel.app).

## Getting Started

### Prerequisites

Before running the project, ensure you have the following installed:

- **Node.js** (latest LTS version recommended)
- **npm** or **Yarn**

### Installation

1. Clone the repository and navigate to the project directory.
2. Install dependencies using `npm install` or `yarn install`.
3. Start the development server by running `npm start` or `yarn start`.
4. The app will be accessible at `http://localhost:3000`.

### Building for Production

To create an optimized production build, run:

- `npm run build` or `yarn build`

This will generate a `build/` directory containing the compiled assets.

### Running Tests

The project includes automated tests using **Jest** and **React Testing Library**. To run tests:

- Execute `npm test` or `yarn test` to run all tests.
- Generate a coverage report using `npm test -- --coverage` or `yarn test --coverage`.

## How Autocomplete Works

The autocomplete feature in the editor follows a structured process:

1. **Trigger Detection** – When a user types `<>`, autocomplete is activated.
2. **Match String Extraction** – The text immediately after `<>` is captured as the **match string**.
3. **Filtering Suggestions** – The dropdown displays **suggestions that match the prefix**.
4. **User Selection**:
   - **Keyboard Navigation** – Users can use `ArrowUp` and `ArrowDown` to highlight suggestions and `Enter` or `Tab` to select them.
   - **Mouse Interaction** – Clicking on a suggestion inserts it into the editor.
5. **Inserting Immutable Tokens** – Once a suggestion is selected, it is inserted as a **non-editable token** with distinct styling.
6. **Removing Tokens** – Pressing `Backspace` deletes an entire token in a single action.

## Future Improvements

- **API-based Dynamic Suggestions** – Instead of hardcoded values, allow suggestions to be fetched from an API.
- **Multiple Autocomplete Triggers** – Support for additional triggers like `@` for mentions or `#` for hashtags.
- **Enhanced Styling and Animations** – Improve dropdown design and add smooth animations.
- **Accessibility Enhancements** – Ensure the dropdown is fully accessible with ARIA attributes and screen reader support.