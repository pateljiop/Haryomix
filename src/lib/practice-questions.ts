export type Track = "school" | "graduation" | "competitive";
export type Question = { prompt: string; options: string[]; answer: number; explanation: string };

export const questionSets: Record<Track, Question[]> = {
  school: [
    { prompt: "What is 25% of 200?", options: ["25", "40", "50", "75"], answer: 2, explanation: "25% = 1/4, and 200 ÷ 4 = 50." },
    { prompt: "What is the SI unit of force?", options: ["Joule", "Newton", "Watt", "Pascal"], answer: 1, explanation: "Force is measured in newtons (N)." },
    { prompt: "Which process do green plants use to make food?", options: ["Respiration", "Photosynthesis", "Evaporation", "Fermentation"], answer: 1, explanation: "Photosynthesis uses light energy to make glucose from carbon dioxide and water." },
    { prompt: "Solve: 3x + 5 = 20.", options: ["3", "5", "7", "15"], answer: 1, explanation: "Subtract 5 to get 3x = 15, then divide by 3: x = 5." },
    { prompt: "Which is the largest planet in our Solar System?", options: ["Earth", "Saturn", "Jupiter", "Neptune"], answer: 2, explanation: "Jupiter is the largest planet in the Solar System." },
  ],
  graduation: [
    { prompt: "Which data structure follows FIFO order?", options: ["Stack", "Queue", "Tree", "Graph"], answer: 1, explanation: "A queue removes items in first-in, first-out order." },
    { prompt: "Which SQL command retrieves data from a table?", options: ["SELECT", "UPDATE", "INSERT", "DROP"], answer: 0, explanation: "SELECT reads rows and columns from one or more tables." },
    { prompt: "How many bits are in one byte?", options: ["4", "8", "16", "32"], answer: 1, explanation: "One byte contains eight bits." },
    { prompt: "Which OS component schedules processes for CPU time?", options: ["Compiler", "Scheduler", "Linker", "Loader only"], answer: 1, explanation: "The CPU scheduler chooses which ready process or thread runs next." },
    { prompt: "What is the time complexity of binary search on a sorted array?", options: ["O(1)", "O(log n)", "O(n)", "O(n²)"], answer: 1, explanation: "Binary search halves the remaining search interval at each step." },
  ],
  competitive: [
    { prompt: "Find the next number: 2, 4, 8, 16, __.", options: ["18", "24", "30", "32"], answer: 3, explanation: "Each term is multiplied by 2, so 16 × 2 = 32." },
    { prompt: "The average of 10, 20 and 30 is:", options: ["15", "20", "25", "30"], answer: 1, explanation: "(10 + 20 + 30) ÷ 3 = 20." },
    { prompt: "India celebrates Republic Day on:", options: ["15 August", "2 October", "26 January", "14 November"], answer: 2, explanation: "The Constitution of India came into effect on 26 January 1950." },
    { prompt: "A train covers 120 km in 2 hours. Its average speed is:", options: ["40 km/h", "50 km/h", "60 km/h", "80 km/h"], answer: 2, explanation: "Speed = distance ÷ time = 120 ÷ 2 = 60 km/h." },
    { prompt: "Choose the word closest in meaning to “brief”.", options: ["Concise", "Distant", "Heavy", "Unclear"], answer: 0, explanation: "Brief means short in duration or concise in wording." },
  ],
};

export const trackLabels: Record<Track, string> = {
  school: "School · Class 6–12",
  graduation: "Graduation · University",
  competitive: "One-Day Competitive Exams",
};
