interface QuestionProps {
  question: {
    text: string;
    options: string[];
  };
  onAnswer: (answer: string) => void;
  disabled?: boolean;
}

export default function Question({ question, onAnswer, disabled }: QuestionProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-2 max-w-sm mx-auto">
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="bg-blue-100 p-1 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-sm font-medium flex-1 leading-none">{question.text}</h2>
      </div>

      <div className="flex flex-col gap-1">
        {question.options.map((option, index) => (
          <label
            key={index}
            className="flex items-center px-1.5 py-1 rounded transition-all cursor-pointer
              bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-blue-200"
          >
            <input
              type="radio"
              value={option}
              name="answer"
              onChange={() => onAnswer(option)}
              className="w-3 h-3 text-blue-600"
            />
            <span className="text-xs mr-1.5">{option}</span>
          </label>
        ))}
      </div>

      <button
        disabled={disabled}
        className="mt-1.5 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-1 px-2 rounded 
          text-xs font-medium disabled:from-gray-400 disabled:to-gray-500 disabled:opacity-60"
      >
        שלח
      </button>
    </div>
  );
} 