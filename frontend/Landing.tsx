export default function Landing() {
    return (
      // center the whole frame on the page
      <div className="min-h-screen bg-gray-100 px-6 grid place-items-center">
        {/* OUTER FRAME */}
        <div className="w-full max-w-5xl rounded-[22px] bg-white shadow-sm border border-gray-200">
          {/* HEADER (logo left, blue) */}
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 pb-3">
              <svg
                width="26" height="26" viewBox="0 0 24 24"
                className="text-[#3b5aa7]" fill="none"
                stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M7 7h11l-3-3" />
                <path d="M18 7l-3 3" />
                <path d="M17 17H6l3 3" />
                <path d="M6 17l3-3" />
              </svg>
              <span className="text-[20px] font-semibold text-[#3b5aa7]">SkillSwap</span>
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>
  
          {/* INNER CARD (bigger + perfectly centered content) */}
          <div className="px-6 py-8">
            <div className="
                rounded-2xl border border-gray-200 bg-white shadow-sm
                w-full
                px-10 py-12 md:px-16 md:py-16
                min-h-[360px] md:min-h-[420px]
                flex items-center justify-center
              ">
              <div className="max-w-2xl w-full text-center">
                <h1 className="text-[30px] md:text-[34px] font-semibold text-slate-800 leading-tight">
                  Learn and Teach Skills
                  <br className="hidden sm:block" />
                  on SkillSwap
                </h1>
  
                <p className="mt-5 text-slate-600">
                  SkillSwap is a platform that connects people who wants to learn new
                  skills with those who can teach.
                </p>
  
                <div className="mt-8 flex items-center justify-center gap-4">
                  <a
                    href="/register"
                    className="inline-flex items-center justify-center rounded-md bg-[#3b5aa7] text-white px-6 py-2.5 text-sm font-medium shadow-sm hover:opacity-95 transition"
                  >
                    Sign Up
                  </a>
                  <a
                    href="/login"
                    className="inline-flex items-center justify-center rounded-md px-6 py-2.5 text-sm font-medium text-[#3b5aa7] border border-slate-300 hover:bg-slate-50 transition"
                  >
                    Sign In
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  