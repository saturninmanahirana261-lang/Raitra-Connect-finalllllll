import React from 'react';
import { Plus } from 'lucide-react';
import type { SocialStory, UserProfile } from '../types';

interface SocialStoriesBarProps {
  stories: SocialStory[];
  currentUser: UserProfile;
  onOpenCreateStory: () => void;
  onSelectStory: (index: number) => void;
}

export const SocialStoriesBar: React.FC<SocialStoriesBarProps> = ({
  stories,
  currentUser,
  onOpenCreateStory,
  onSelectStory
}) => {
  // Regrouper les stories par auteur unique
  const uniqueAuthorStories = stories.reduce((acc, story) => {
    if (!acc.some((s) => s.authorUid === story.authorUid)) {
      acc.push(story);
    }
    return acc;
  }, [] as SocialStory[]);

  const myStory = stories.find((s) => s.authorUid === currentUser.uid);

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none py-1">
      {/* Create / View My Story Bubble */}
      <div
        onClick={myStory ? () => onSelectStory(stories.indexOf(myStory)) : onOpenCreateStory}
        className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
      >
        <div className="relative">
          <div
            className={`w-14 h-14 rounded-2xl p-0.5 transition transform group-hover:scale-105 ${
              myStory
                ? 'bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-md'
                : 'border-2 border-dashed border-slate-300 dark:border-slate-700'
            }`}
          >
            <div className="w-full h-full rounded-[14px] bg-indigo-600 text-white flex items-center justify-center font-bold text-base overflow-hidden">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt={currentUser.displayName} className="w-full h-full object-cover" />
              ) : (
                currentUser.displayName?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
          </div>

          {!myStory && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900 text-white flex items-center justify-center">
              <Plus className="w-3 h-3 stroke-[3]" />
            </div>
          )}
        </div>

        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 max-w-[64px] truncate text-center">
          {myStory ? 'Votre story' : 'Ajouter'}
        </span>
      </div>

      {/* Other Stories */}
      {uniqueAuthorStories
        .filter((s) => s.authorUid !== currentUser.uid)
        .map((story) => {
          const index = stories.findIndex((s) => s.id === story.id);
          const isViewed = story.viewers.includes(currentUser.uid);

          return (
            <div
              key={story.id}
              onClick={() => onSelectStory(index)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
            >
              <div
                className={`w-14 h-14 rounded-2xl p-0.5 transition transform group-hover:scale-105 ${
                  isViewed
                    ? 'border-2 border-slate-300 dark:border-slate-700'
                    : 'bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-md'
                }`}
              >
                <div className="w-full h-full rounded-[14px] bg-slate-800 text-white flex items-center justify-center font-bold text-sm overflow-hidden">
                  {story.authorPhotoURL ? (
                    <img src={story.authorPhotoURL} alt={story.authorName} className="w-full h-full object-cover" />
                  ) : (
                    story.authorName.charAt(0).toUpperCase()
                  )}
                </div>
              </div>

              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 max-w-[64px] truncate text-center">
                {story.authorName.split(' ')[0]}
              </span>
            </div>
          );
        })}
    </div>
  );
};
