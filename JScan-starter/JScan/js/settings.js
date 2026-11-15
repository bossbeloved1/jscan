
/* ==========================================
   JSCAN - SETTINGS SYSTEM
========================================== */

document.addEventListener('DOMContentLoaded', async () => {

    const db = window.jscanDB;

    // ======================================
    // ELEMENTS
    // ======================================

    const avatarPreview =
        document.getElementById('settingsAvatarPreview');

    const avatarInput =
        document.getElementById('avatarInput');

    const chooseAvatarBtn =
        document.getElementById('chooseAvatarBtn');

    const removeAvatarBtn =
        document.getElementById('removeAvatarBtn');

    const profileForm =
        document.getElementById('profileForm');

    const displayNameInput =
        document.getElementById('displayName');

    const accountEmail =
        document.getElementById('accountEmail');

    const saveProfileBtn =
        document.getElementById('saveProfileBtn');

    const profileMessage =
        document.getElementById('profileMessage');

    const passwordForm =
        document.getElementById('passwordForm');

    const newPasswordInput =
        document.getElementById('newPassword');

    const confirmPasswordInput =
        document.getElementById('confirmPassword');

    const changePasswordBtn =
        document.getElementById('changePasswordBtn');

    const passwordMessage =
        document.getElementById('passwordMessage');

    const logoutBtn =
        document.getElementById('settingsLogoutBtn');

    const generalMessage =
        document.getElementById('settingsGeneralMessage');


    // ======================================
    // DEFAULT SETTINGS
    // ======================================

    const defaultAvatar =
        'https://placehold.co/160x160/eaf0ff/2563eb?text=J';

    let currentUser = null;
    let currentAvatarUrl = null;
    let selectedAvatarFile = null;
    let removeAvatar = false;

    let currentProfileName = '';


    // ======================================
    // MESSAGE FUNCTION
    // ======================================

    function showMessage(element, message, type = 'error') {

        if (!element) return;

        element.textContent = message;
        element.className = 'settings-message ' + type;
    }


    function clearMessage(element) {

        if (!element) return;

        element.textContent = '';
        element.className = 'settings-message';
    }


    // ======================================
    // SUPABASE CONNECTION
    // ======================================

    if (!db) {

        if (generalMessage) {
            generalMessage.textContent =
                'Connection error. Please refresh the page.';
        }

        return;
    }


    // ======================================
    // CHECK LOGIN SESSION
    // ======================================

    let session;

    try {

        const { data, error } = await db.auth.getSession();

        if (error) throw error;

        session = data.session;

    } catch (error) {

        console.error('Session error:', error);

        window.location.replace('login.html');

        return;
    }


    // Protect settings page
    if (!session) {

        window.location.replace('login.html');

        return;
    }

    currentUser = session.user;


    // ======================================
    // LOAD USER PROFILE
    // ======================================

    async function loadProfile() {

        try {

            const { data: profile, error } = await db
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('id', currentUser.id)
                .maybeSingle();

            if (error) throw error;

            currentProfileName =
                profile?.display_name ||
                currentUser.user_metadata?.display_name ||
                currentUser.email?.split('@')[0] ||
                'User';

            currentAvatarUrl =
                profile?.avatar_url || null;

            // Display name
            if (displayNameInput) {
                displayNameInput.value = currentProfileName;
            }

            // Registered email
            if (accountEmail) {
                accountEmail.value = currentUser.email || '';
            }

            // Profile picture
            if (avatarPreview) {

                avatarPreview.src =
                    currentAvatarUrl || defaultAvatar;

                avatarPreview.onerror = () => {
                    avatarPreview.src = defaultAvatar;
                };
            }

        } catch (error) {

            console.error('Profile loading error:', error);

            showMessage(
                profileMessage,
                'Unable to load your profile. Please refresh the page.'
            );
        }
    }


    await loadProfile();


    // ======================================
    // AVATAR FILE SELECTION
    // ======================================

    if (chooseAvatarBtn && avatarInput) {

        chooseAvatarBtn.addEventListener('click', () => {
            avatarInput.click();
        });

    }


    // Preview selected image
    if (avatarInput) {

        avatarInput.addEventListener('change', () => {

            clearMessage(profileMessage);

            const file = avatarInput.files[0];

            if (!file) return;

            const allowedTypes = [
                'image/jpeg',
                'image/png',
                'image/webp'
            ];

            if (!allowedTypes.includes(file.type)) {

                showMessage(
                    profileMessage,
                    'Please select a JPG, PNG or WebP image.'
                );

                avatarInput.value = '';

                return;
            }

            // Maximum file size: 2MB
            if (file.size > 2 * 1024 * 1024) {

                showMessage(
                    profileMessage,
                    'Your profile picture must not exceed 2MB.'
                );

                avatarInput.value = '';

                return;
            }

            selectedAvatarFile = file;
            removeAvatar = false;

            // Preview before uploading
            const previewUrl = URL.createObjectURL(file);

            if (avatarPreview) {

                avatarPreview.src = previewUrl;

                avatarPreview.onerror = () => {
                    avatarPreview.src = defaultAvatar;
                };
            }

            showMessage(
                profileMessage,
                'Picture selected. Click Save Profile Changes to upload it.',
                'success'
            );

        });

    }


    // ======================================
    // REMOVE PROFILE PICTURE
    // ======================================

    if (removeAvatarBtn) {

        removeAvatarBtn.addEventListener('click', () => {

            selectedAvatarFile = null;
            removeAvatar = true;

            if (avatarInput) {
                avatarInput.value = '';
            }

            if (avatarPreview) {
                avatarPreview.src = defaultAvatar;
            }

            showMessage(
                profileMessage,
                'Profile picture marked for removal. Save your changes to confirm.',
                'success'
            );

        });

    }


    // ======================================
    // GET AVATAR STORAGE PATH
    // ======================================

    function getAvatarStoragePath(url) {

        if (!url) return null;

        const marker =
            '/storage/v1/object/public/avatars/';

        const markerIndex = url.indexOf(marker);

        if (markerIndex === -1) return null;

        const encodedPath =
            url.substring(markerIndex + marker.length);

        try {
            return decodeURIComponent(encodedPath);
        } catch {
            return encodedPath;
        }
    }


    // ======================================
    // SAVE PROFILE CHANGES
    // ======================================

    if (profileForm) {

        profileForm.addEventListener('submit', async (event) => {

            event.preventDefault();

            clearMessage(profileMessage);

            const displayName =
                displayNameInput.value.trim();

            if (!displayName) {

                showMessage(
                    profileMessage,
                    'Please enter your display name.'
                );

                return;
            }

            if (displayName.length > 60) {

                showMessage(
                    profileMessage,
                    'Your display name cannot exceed 60 characters.'
                );

                return;
            }

            saveProfileBtn.disabled = true;
            saveProfileBtn.textContent = 'Saving...';

            try {

                let newAvatarUrl = currentAvatarUrl;

                const oldAvatarPath =
                    getAvatarStoragePath(currentAvatarUrl);


                // Upload new avatar if selected
                if (selectedAvatarFile) {

                    const file = selectedAvatarFile;

                    const extension =
                        file.type === 'image/png'
                            ? 'png'
                            : file.type === 'image/webp'
                                ? 'webp'
                                : 'jpg';

                    const filePath =
                        `${currentUser.id}/avatar-${Date.now()}.${extension}`;

                    const { error: uploadError } = await db
                        .storage
                        .from('avatars')
                        .upload(filePath, file, {
                            cacheControl: '3600',
                            upsert: false,
                            contentType: file.type
                        });

                    if (uploadError) throw uploadError;

                    const { data: imageData } = db
                        .storage
                        .from('avatars')
                        .getPublicUrl(filePath);

                    newAvatarUrl = imageData.publicUrl;
                }


                // Remove avatar if requested
                if (removeAvatar) {
                    newAvatarUrl = null;
                }


                // Save profile information
                const { error: profileError } = await db
                    .from('profiles')
                    .upsert({
                        id: currentUser.id,
                        display_name: displayName,
                        avatar_url: newAvatarUrl
                    }, {
                        onConflict: 'id'
                    });

                if (profileError) throw profileError;


                // Update Supabase user metadata
                const { error: metadataError } = await db.auth.updateUser({
                    data: {
                        display_name: displayName
                    }
                });

                if (metadataError) {
                    console.error(
                        'User metadata update error:',
                        metadataError
                    );
                }


                // Delete old avatar after successful profile update
                if (
                    oldAvatarPath &&
                    (
                        selectedAvatarFile ||
                        removeAvatar
                    )
                ) {

                    const { error: deleteError } = await db
                        .storage
                        .from('avatars')
                        .remove([oldAvatarPath]);

                    if (deleteError) {
                        console.error(
                            'Old avatar deletion error:',
                            deleteError
                        );
                    }
                }


                // Update local values
                currentProfileName = displayName;
                currentAvatarUrl = newAvatarUrl;

                selectedAvatarFile = null;
                removeAvatar = false;

                if (avatarInput) {
                    avatarInput.value = '';
                }

                if (avatarPreview) {
                    avatarPreview.src =
                        currentAvatarUrl || defaultAvatar;
                }

                showMessage(
                    profileMessage,
                    'Your profile has been updated successfully!',
                    'success'
                );

            } catch (error) {

                console.error('Profile update error:', error);

                showMessage(
                    profileMessage,
                    error.message ||
                    'Unable to update your profile. Please try again.'
                );

            } finally {

                saveProfileBtn.disabled = false;
                saveProfileBtn.textContent =
                    'Save Profile Changes';
            }

        });

    }


    // ======================================
    // CHANGE PASSWORD
    // ======================================

    if (passwordForm) {

        passwordForm.addEventListener('submit', async (event) => {

            event.preventDefault();

            clearMessage(passwordMessage);

            const newPassword =
                newPasswordInput.value;

            const confirmPassword =
                confirmPasswordInput.value;


            // Validate password length
            if (newPassword.length < 8) {

                showMessage(
                    passwordMessage,
                    'Your password must contain at least 8 characters.'
                );

                return;
            }


            // Confirm passwords match
            if (newPassword !== confirmPassword) {

                showMessage(
                    passwordMessage,
                    'Your passwords do not match.'
                );

                return;
            }


            changePasswordBtn.disabled = true;
            changePasswordBtn.textContent = 'Updating...';

            try {

                const { error } = await db.auth.updateUser({
                    password: newPassword
                });

                if (error) throw error;

                passwordForm.reset();

                showMessage(
                    passwordMessage,
                    'Your password has been updated successfully!',
                    'success'
                );

            } catch (error) {

                console.error('Password update error:', error);

                showMessage(
                    passwordMessage,
                    error.message ||
                    'Unable to update your password. Please try again.'
                );

            } finally {

                changePasswordBtn.disabled = false;
                changePasswordBtn.textContent =
                    'Update Password';
            }

        });

    }


    // ======================================
    // LOG OUT
    // ======================================

    if (logoutBtn) {

        logoutBtn.addEventListener('click', async () => {

            const confirmed = window.confirm(
                'Are you sure you want to log out of JScan?'
            );

            if (!confirmed) return;

            logoutBtn.disabled = true;
            logoutBtn.textContent = 'Logging out...';

            try {

                const { error } = await db.auth.signOut();

                if (error) throw error;

                window.location.replace('login.html');

            } catch (error) {

                console.error('Logout error:', error);

                if (generalMessage) {
                    generalMessage.textContent =
                        'Unable to log out. Please try again.';
                }

                logoutBtn.disabled = false;
                logoutBtn.textContent = 'Log Out';
            }

        });

    }

});
