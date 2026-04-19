# Ferret

<img src="public/ferret.png" alt="Ferret" width="400">

Ferret is a private workspace explorer with built-in AI. Ferret help developers and researchers search and understand large folders of files without uploading their data anywhere. 

Reading through an unfamiliar codebase or scattered documents takes hours. You want to ask AI to explain it, but you cannot upload sensitive company code or private research to cloud tools like ChatGPT. 

**Example usage**: A developer downloads a massive, undocumented software project. They open Ferret in their browser, point it to the project folder, and instantly search for "authentication." They open the login file and ask the built-in AI, "How does the login flow work here?" to get an instant, private answer.

## Features

- **Instant Local Search**: Find keywords across thousands of files instantly in your browser.
- **Private AI Explanations**: Ask questions about your code. The AI model runs completely on your own device—zero data leaves your computer.
- **Secure File Access**: Reads your local folders directly using modern web APIs. No backend needed.

## Getting Started

First, install dependencies and start the local development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Usage

1. **Select a Folder**: When the app opens, click the prompt to select a local folder on your computer. Your browser will ask for permission to read the files.
2. **Search**: Type in the search bar to find files containing your keywords.
3. **Explore & Explain**: Click on any file to view its contents. Ask the built-in AI questions about the file to get plain-English explanations.

## Contributing

We welcome contributions! 
- If you find a bug or have a feature request, please open a GitHub issue.
- If you want to contribute code, fork the repository, make your changes, and submit a pull request.