
/* =====================================
   JSCAN CONTACT FORM
   SUPABASE DATABASE CONNECTION
===================================== */

document.addEventListener("DOMContentLoaded", () => {

    const contactForm = document.getElementById("contactForm");

    if (!contactForm) return;

    const nameInput = document.getElementById("contactName");
    const emailInput = document.getElementById("contactEmail");
    const subjectInput = document.getElementById("contactSubject");
    const messageInput = document.getElementById("contactMessage");

    const submitButton = contactForm.querySelector(
        'button[type="submit"]'
    );

    const statusMessage = document.getElementById(
        "contactFormStatus"
    );

    /* =====================================
       CONTACT FORM SUBMISSION
    ===================================== */

    contactForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const subject = subjectInput.value;
        const message = messageInput.value.trim();

        // Clear previous status
        statusMessage.textContent = "";
        statusMessage.style.color = "";

        // Validate fields
        if (!name || !email || !subject || !message) {

            statusMessage.textContent =
                "Please complete all fields.";

            statusMessage.style.color = "#d94848";

            return;
        }

        if (name.length < 2 || name.length > 100) {

            statusMessage.textContent =
                "Your name must be between 2 and 100 characters.";

            statusMessage.style.color = "#d94848";

            nameInput.focus();

            return;
        }

        if (
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {

            statusMessage.textContent =
                "Please enter a valid email address.";

            statusMessage.style.color = "#d94848";

            emailInput.focus();

            return;
        }

        if (message.length < 10 || message.length > 5000) {

            statusMessage.textContent =
                "Your message must be between 10 and 5,000 characters.";

            statusMessage.style.color = "#d94848";

            messageInput.focus();

            return;
        }

        // Check Supabase connection
        if (!window.jscanDB) {

            statusMessage.textContent =
                "Database connection unavailable. Please refresh the page.";

            statusMessage.style.color = "#d94848";

            console.error(
                "JScan Supabase connection was not found."
            );

            return;
        }

        // Loading state
        submitButton.disabled = true;
        submitButton.textContent = "Sending message...";

        contactForm.setAttribute("aria-busy", "true");

        try {

            // Submit message to Supabase
            const { error } = await window.jscanDB
                .from("contact_messages")
                .insert([
                    {
                        name: name,
                        email: email,
                        subject: subject,
                        message: message
                    }
                ]);

            if (error) {

                console.error(
                    "Supabase contact submission error:",
                    error
                );

                throw error;
            }

            // Success
            statusMessage.textContent =
                "Your message has been submitted successfully. Thank you for contacting JScan!";

            statusMessage.style.color = "#16834a";

            // Clear form
            contactForm.reset();

        } catch (error) {

            console.error(
                "Contact form submission failed:",
                error
            );

            statusMessage.textContent =
                "We couldn't submit your message. Please check your internet connection and try again.";

            statusMessage.style.color = "#d94848";

        } finally {

            // Restore button
            submitButton.disabled = false;
            submitButton.textContent = "Send message →";

            contactForm.removeAttribute("aria-busy");

        }

    });


    /* =====================================
       FAQ ACCORDION
    ===================================== */

    const faqButtons = document.querySelectorAll(
        ".faq-question"
    );

    faqButtons.forEach((button) => {

        button.addEventListener("click", () => {

            const currentItem = button.closest(".faq-item");

            const isOpen = currentItem.classList.contains("open");

            // Close all FAQ items
            document.querySelectorAll(".faq-item").forEach((item) => {

                item.classList.remove("open");

                const question = item.querySelector(
                    ".faq-question"
                );

                question.setAttribute(
                    "aria-expanded",
                    "false"
                );

            });

            // Open selected item if it was previously closed
            if (!isOpen) {

                currentItem.classList.add("open");

                button.setAttribute(
                    "aria-expanded",
                    "true"
                );

            }

        });

    });

});
